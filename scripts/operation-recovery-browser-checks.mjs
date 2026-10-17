import assert from 'node:assert/strict';
import {watchSyncStatus,waitForSync,readSavedOutbox} from './sync-browser-utils.mjs';

export async function checkOperationRecovery(browser,{origin,settings,sampleMember}) {
  const owner='88888888-8888-4888-8888-888888888888',operation='99999999-9999-4999-8999-999999999999';
  const user={id:owner,email:'recovery@example.test',email_confirmed_at:'2026-10-16T00:00:00Z',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{}};
  const profile={id:owner,email:user.email,role:'super_admin',first_name:'Recovery',last_name:'Admin',is_active:true,has_login_account:true,authorization_reviewed_at:'2026-10-16T00:00:00Z'};
  const exp=Math.floor(Date.now()/1000)+3600,token=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:owner,role:'authenticated',exp})).toString('base64url')}.test-signature`;
  const session={user,access_token:token,refresh_token:'recovery-refresh-token',expires_at:exp,expires_in:3600,token_type:'bearer'};
  const members=Array.from({length:20},(_,i)=>({...sampleMember,id:`recovery-member-${i}`,member_id:`GWCC-RECOVERY-${i}`,first_name:'Recovery',last_name:String(i),auth_user_id:null,updated_at:'2026-10-15T00:00:00Z',...(i===19?{profile_photo_url:'data:image/jpeg;base64,'+'A'.repeat(110000)}:{})}));
  const changes=[{table:'settings',operation:'upsert',id:'gwcc_global_settings',record:{id:'gwcc_global_settings',...settings}},...members.map(record=>({table:'members',operation:'upsert',id:record.id,record}))];
  const legacy={id:operation,changes,createdAt:'2026-10-15T00:00:00Z',attempts:1,error:'Operation ID was reused with different data'};
  const tables={profiles:[profile],settings:[changes[0].record],members:members.slice(0,19)};
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  await context.addInitScript(watchSyncStatus);
  await context.addInitScript(({owner,session,legacy})=>{
    if(localStorage.getItem('gwcc-recovery-fixture-seeded'))return;
    localStorage.setItem('gwcc-recovery-fixture-seeded','yes');
    localStorage.setItem('gwcc_supabase_url','https://gwcc-e2e.supabase.co');localStorage.setItem('gwcc_supabase_anon_key','test-public-key');
    localStorage.setItem('gwcc-church-auth-token',JSON.stringify(session));localStorage.setItem(`gwcc_cache_role_${owner}`,'super_admin');
    localStorage.setItem(`gwcc_outbox_v2_${owner}`,JSON.stringify([legacy]));
  },{owner,session,legacy});
  const calls=[],receipts=new Map();let loseConnection=true,writes=0;
  await context.route('https://gwcc-e2e.supabase.co/**',async route=>{
    const request=route.request(),url=new URL(request.url()),headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','content-type':'application/json'};
    if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
    let result=[];
    if(url.pathname==='/rest/v1/rpc/gwcc_security_status')result={role:profile.role,required:profile.role!=="member",verified_factors:profile.role==="member"?0:1,satisfied:true};
    else if(url.pathname==='/auth/v1/user')result=user;
    else if(url.pathname==='/auth/v1/token')result=session;
    else if(url.pathname==='/auth/v1/logout'){await route.fulfill({status:204,headers});return;}
    else if(url.pathname==='/rest/v1/rpc/gwcc_apply_mutations'){
      const args=request.postDataJSON();calls.push({name:'apply',args});
      assert.equal(args.p_operation_id,operation);
      await route.fulfill({status:400,headers,body:JSON.stringify({message:'Operation ID was reused with different data'})});return;
    }else if(url.pathname==='/rest/v1/rpc/gwcc_reconcile_sync_operation'){
      const args=request.postDataJSON();calls.push({name:'reconcile',args});
      assert.equal(args.p_original_operation_id,operation);assert.notEqual(args.p_recovery_operation_id,operation);assert.deepEqual(args.p_changes,changes);
      if(loseConnection){loseConnection=false;await route.fulfill({status:503,headers,body:JSON.stringify({message:'Synthetic recovery connection lost'})});return;}
      if(!receipts.has(args.p_recovery_operation_id)){
        if(!tables.members.some(row=>row.id===members[19].id)){tables.members.push(members[19]);writes++;}
        receipts.set(args.p_recovery_operation_id,changes.map(c=>({table:c.table,record:c.record})));
      }
      result=receipts.get(args.p_recovery_operation_id);
    }else if(url.pathname.startsWith('/rest/v1/')){
      const table=url.pathname.split('/').at(-1),rows=tables[table]||[];
      const range=request.headers().range?.split('-').map(Number),offset=Number(url.searchParams.get('offset')||range?.[0]||0),limit=Number(url.searchParams.get('limit')||500);
      result=rows.slice(offset,offset+limit);if(request.headers().accept?.includes('vnd.pgrst.object'))result=result[0]||null;
    }
    await route.fulfill({status:200,headers,body:JSON.stringify(result)});
  });
  try{
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`${origin}/members`);await page.getByText('21 changes awaiting cloud confirmation.',{exact:true}).waitFor();assert.equal(calls.length,0);
    await page.getByRole('button',{name:'Review pending changes',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Review pending changes',exact:true});
    const downloadEvent=page.waitForEvent('download');await dialog.getByRole('button',{name:'Export pending changes',exact:true}).click();
    const downloaded=await downloadEvent,chunks=[];for await(const chunk of await downloaded.createReadStream())chunks.push(chunk);
    const backup=JSON.parse(Buffer.concat(chunks).toString());assert.equal(backup.batches[0].changes.length,21);assert.equal(backup.batches[0].changes.at(-1).record.profile_photo_url,members[19].profile_photo_url);
    await dialog.getByRole('button',{name:'Close',exact:true}).click();
    await page.getByRole('button',{name:'Retry sync',exact:true}).click();await page.getByText('Synthetic recovery connection lost',{exact:true}).waitFor();
    const firstRecovery=calls.at(-1);assert.equal(firstRecovery.name,'reconcile');
    assert.equal((await readSavedOutbox(page,owner)).batches[0].recoveryId,firstRecovery.args.p_recovery_operation_id);
    const beforeReload=calls.length;await page.reload();await page.getByText('Synthetic recovery connection lost',{exact:true}).waitFor();assert.equal(calls.length,beforeReload);
    await page.evaluate(()=>{
      window.__GWCC_ORIGINAL_IDB_PUT__=IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put=function(value,...args){if(this.name==='outboxes'&&value.batches?.length===0)throw new DOMException('Synthetic recovery cleanup failure','QuotaExceededError');return window.__GWCC_ORIGINAL_IDB_PUT__.call(this,value,...args);};
    });
    await page.getByRole('button',{name:'Retry sync',exact:true}).click();await page.getByText(/Synthetic recovery cleanup failure/).first().waitFor();assert.equal(writes,1);
    assert.equal((await readSavedOutbox(page,owner)).batches[0].changes.length,21);assert.deepEqual(calls.at(-1),firstRecovery);
    await page.evaluate(()=>{IDBObjectStore.prototype.put=window.__GWCC_ORIGINAL_IDB_PUT__;});
    await page.getByRole('button',{name:'Retry sync',exact:true}).click();await waitForSync(page);
    assert.deepEqual(calls.at(-1),firstRecovery);assert.equal(writes,1);assert.equal(receipts.size,1);assert.equal((await readSavedOutbox(page,owner)).batches.length,0);assert.deepEqual(errors,[]);
    console.info('Operation recovery browser checks passed: 21 preserved changes, 20 already confirmed, one outstanding write, stable recovery through lost connection/reload/cleanup failure, and complete photo backup.');
  }finally{await context.close();}
}
