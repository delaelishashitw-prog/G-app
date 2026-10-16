import assert from 'node:assert/strict';
import {watchSyncStatus,waitForSync,readSavedOutbox} from './sync-browser-utils.mjs';

export async function checkStorageQuota(browser,{origin,settings,sampleMember}) {
  const owner='66666666-6666-4666-8666-666666666666',operation='77777777-7777-4777-8777-777777777777';
  const user={id:owner,email:'quota@example.test',email_confirmed_at:'2026-10-16T00:00:00Z',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{}};
  const profile={id:owner,email:user.email,role:'super_admin',first_name:'Quota',last_name:'Admin',is_active:true,has_login_account:true,authorization_reviewed_at:'2026-10-16T00:00:00Z'};
  const exp=Math.floor(Date.now()/1000)+3600,token=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:owner,role:'authenticated',exp})).toString('base64url')}.test-signature`;
  const session={user,access_token:token,refresh_token:'quota-refresh-token',expires_at:exp,expires_in:3600,token_type:'bearer'};
  const photo='data:image/jpeg;base64,'+'A'.repeat(110000);
  const member={...sampleMember,id:'quota-member',member_id:'GWCC-QUOTA',first_name:'Quota',last_name:'Member',profile_photo_url:photo,updated_at:'2026-10-15T00:00:00Z'};
  const legacy={id:operation,changes:[{table:'members',operation:'upsert',id:member.id,record:{...member,first_name:'Quota Updated'},expected_updated_at:member.updated_at}],createdAt:'2026-10-15T00:00:00Z',attempts:1,error:'Synthetic cloud unavailable'};
  const tables={profiles:[profile],members:[member],settings:[{id:'gwcc_global_settings',...settings}]};
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  await context.addInitScript(watchSyncStatus);
  await context.addInitScript(({owner,session,legacy})=>{
    if(localStorage.getItem('gwcc-quota-fixture-seeded'))return;
    localStorage.setItem('gwcc-quota-fixture-seeded','yes');
    localStorage.setItem('gwcc_supabase_url','https://gwcc-e2e.supabase.co');localStorage.setItem('gwcc_supabase_anon_key','test-public-key');
    localStorage.setItem('gwcc-church-auth-token',JSON.stringify(session));localStorage.setItem(`gwcc_cache_role_${owner}`,'super_admin');
    localStorage.setItem(`gwcc_outbox_v2_${owner}`,JSON.stringify([legacy]));localStorage.setItem(`gwcc_versions_v2_${owner}`,JSON.stringify({'members:quota-member':'2026-10-15T00:00:00Z'}));
    localStorage.setItem('gwcc_outbox_v2_other-account','keep-other-pending');localStorage.setItem('gwcc_cache_other-account_members','keep-other-cache');
    let filler='';
    for(const size of [65536,1024])for(;;){try{const next=filler+'X'.repeat(size);localStorage.setItem('gwcc_quota_fixture_filler',next);filler=next;}catch{break;}}
    let full=false;try{localStorage.setItem('gwcc_quota_expected_failure','X'.repeat(4096));}catch(error){full=error.name==='QuotaExceededError';}
    window.__GWCC_QUOTA_REPRODUCED__=full;
  },{owner,session,legacy});
  const calls=[],committed=new Map();let rejectWrites=true;
  await context.route('https://gwcc-e2e.supabase.co/**',async route=>{
    const request=route.request(),url=new URL(request.url()),headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','content-type':'application/json'};
    if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
    let result=[];
    if(url.pathname==='/auth/v1/user')result=user;
    else if(url.pathname==='/auth/v1/token')result=session;
    else if(url.pathname==='/auth/v1/logout'){await route.fulfill({status:204,headers});return;}
    else if(url.pathname==='/rest/v1/rpc/gwcc_apply_mutations'){
      const args=request.postDataJSON();calls.push(args);
      if(rejectWrites){await route.fulfill({status:503,headers,body:JSON.stringify({message:'Synthetic cloud unavailable'})});return;}
      if(!committed.has(args.p_operation_id)){
        const records=args.p_changes.filter(c=>c.table!=='audit_logs').map(c=>({table:c.table,record:{...c.record,updated_at:'2026-10-16T00:00:00Z'}}));
        committed.set(args.p_operation_id,records);
        for(const item of records)tables[item.table]=[item.record,...(tables[item.table]||[]).filter(row=>row.id!==item.record.id)];
      }
      result=committed.get(args.p_operation_id);
    }else if(url.pathname.startsWith('/rest/v1/')){
      const table=url.pathname.split('/').at(-1),rows=tables[table]||[];
      const range=request.headers().range?.split('-').map(Number),offset=Number(url.searchParams.get('offset')||range?.[0]||0),limit=Number(url.searchParams.get('limit')||500);
      result=rows.slice(offset,offset+limit);if(request.headers().accept?.includes('vnd.pgrst.object'))result=result[0]||null;
    }
    await route.fulfill({status:200,headers,body:JSON.stringify(result)});
  });
  try{
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`${origin}/members`);await page.getByText('Recovered changes are waiting for review. Use Retry sync when ready.',{exact:true}).first().waitFor();
    assert.equal(calls.length,0,'Migrated work must wait for the old tab’s memory-only backup before sending.');
    await page.getByRole('button',{name:'Retry sync',exact:true}).click();await page.getByText('Synthetic cloud unavailable',{exact:true}).first().waitFor();
    assert.equal(await page.evaluate(()=>window.__GWCC_QUOTA_REPRODUCED__),true,'Fixture must reproduce a real browser quota exception.');
    let saved=await readSavedOutbox(page,owner);assert.equal(saved.batches[0].id,operation);assert.deepEqual(saved.batches[0].changes,legacy.changes);
    const preserved=await page.evaluate(owner=>({legacy:localStorage.getItem(`gwcc_outbox_v2_${owner}`),other:localStorage.getItem('gwcc_outbox_v2_other-account'),cache:localStorage.getItem('gwcc_cache_other-account_members'),auth:Boolean(localStorage.getItem('gwcc-church-auth-token')),filler:localStorage.getItem('gwcc_quota_fixture_filler')?.length}),owner);
    assert.equal(preserved.legacy,null);assert.equal(preserved.other,'keep-other-pending');assert.equal(preserved.cache,'keep-other-cache');assert.equal(preserved.auth,true);assert.ok(preserved.filler>4000000);
    await page.getByRole('button',{name:'Review pending changes',exact:true}).click();
    const review=page.getByRole('dialog',{name:'Review pending changes',exact:true});
    assert.ok((await review.locator('pre').innerText()).length<50000);assert.match(await review.locator('pre').innerText(),/Embedded file/);
    const downloadEvent=page.waitForEvent('download');await review.getByRole('button',{name:'Export pending changes',exact:true}).click();
    const download=await downloadEvent,chunks=[];for await(const chunk of await download.createReadStream())chunks.push(chunk);
    const backup=Buffer.concat(chunks);assert.equal(JSON.parse(backup.toString()).batches[0].changes[0].record.profile_photo_url,photo);
    await review.getByRole('button',{name:'Close',exact:true}).click();
    await page.evaluate(()=>{
      window.__GWCC_ORIGINAL_IDB_PUT__=IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put=function(value,...args){if(this.name==='outboxes'&&value.batches?.length===0)throw new DOMException('Synthetic cleanup storage full','QuotaExceededError');return window.__GWCC_ORIGINAL_IDB_PUT__.call(this,value,...args);};
    });
    rejectWrites=false;await page.getByRole('button',{name:'Retry sync',exact:true}).click();
    await page.getByText(/Synthetic cleanup storage full/).first().waitFor();assert.equal(committed.size,1);
    saved=await readSavedOutbox(page,owner);assert.equal(saved.batches[0].id,operation);assert.equal(saved.batches.length,1);
    await page.evaluate(()=>{IDBObjectStore.prototype.put=window.__GWCC_ORIGINAL_IDB_PUT__;});
    await page.getByRole('button',{name:'Retry sync',exact:true}).click();await waitForSync(page);
    assert.equal(committed.size,1);assert.equal((await readSavedOutbox(page,owner)).batches.length,0);
    assert.deepEqual(calls.at(-1),calls.at(-2),'Cleanup retry must preserve both request ID and payload.');

    await page.goto(`${origin}/settings`);await page.getByRole('button',{name:'Supabase PostgreSQL Hub',exact:true}).click();
    const beforeRestore=calls.length;
    await page.getByLabel('Pending changes backup file',{exact:true}).setInputFiles({name:'pending.json',mimeType:'application/json',buffer:backup});
    await page.getByRole('status').filter({hasText:'1 pending change restored'}).waitFor();
    assert.equal((await readSavedOutbox(page,owner)).batches[0].requiresReview,true);
    await page.reload();await page.getByText('Recovered changes are waiting for review. Use Retry sync when ready.',{exact:true}).first().waitFor();
    assert.equal(calls.length,beforeRestore,'Restoring and reloading must not send an unreviewed backup.');
    await page.getByRole('button',{name:'Retry sync',exact:true}).click();await waitForSync(page);assert.equal(committed.size,1);
    assert.equal((await readSavedOutbox(page,owner)).batches.length,0);
    assert.deepEqual(errors,[]);
    console.info('Storage browser checks passed: real localStorage quota, committed IndexedDB migration, protected accounts/auth/cache, complete export, cleanup failure retry without duplicates, and reviewed backup restore across reload.');
  }finally{await context.close();}
}
