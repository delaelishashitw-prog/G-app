import assert from 'node:assert/strict';
import { watchSyncStatus, waitForSync, readSavedOutbox } from './sync-browser-utils.mjs';

export async function checkReliableOperations(browser,{origin,settings,sampleMember}) {
  const owner='61616161-6161-4161-8161-616161616161',now=new Date().toISOString();
  const profile={id:owner,email:'operations@example.test',first_name:'Synthetic',last_name:'Operator',role:'super_admin',is_active:true,has_login_account:true,authorization_reviewed_at:now};
  const user={id:owner,email:profile.email,email_confirmed_at:now,aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{}};
  const exp=Math.floor(Date.now()/1000)+3600,token=`${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:owner,role:'authenticated',aal:'aal2',session_id:owner,exp})).toString('base64url')}.synthetic`;
  const session={user,access_token:token,refresh_token:'synthetic-operations-refresh',expires_at:exp,expires_in:3600,token_type:'bearer'};
  const members=['student-member','old-graduate'].map((id,index)=>({...sampleMember,id,member_id:`GWCC-OPS-${index}`,first_name:'Synthetic',last_name:index?'Graduate':'Student',email:`${id}@example.test`,auth_user_id:null,membership_class_completed:false,is_archived:false,updated_at:now}));
  const data={profiles:[profile],settings:[{id:'gwcc_global_settings',...settings}],members,assets:[],foundation_cohorts:[{id:'ops-class',name:'Synthetic Class',status:'active',start_date:now.slice(0,10),instructor_name:'Synthetic Teacher',created_at:now}],
    foundation_students:members.map((member,index)=>({id:`student-${index}`,cohort_id:'ops-class',cohort_name:'Synthetic Class',member_id:member.id,member_name:`${member.first_name} ${member.last_name}`,enrollment_date:now.slice(0,10),completed_modules:index?[1,2,3,4,5]:[],status:index?'graduated':'in_progress',...(index?{certificate_no:'ORIGINAL-CERTIFICATE',graduation_date:'2020-01-01'}:{}),created_at:now,updated_at:now}))};
  const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Africa/Accra'}),requests=[],accountActions=[],errors=[];
  let failCloud=false,activationError=false,activationEmpty=false;
  const activationRows=[['needs_email','Needs Email'],['not_invited','New Member'],['needs_link','Existing Login'],['pending','Pending Member'],['ready','Verified Member'],['review','Blocked Member']].map(([state,name],index)=>({id:members[index%2].id+index,member_id:`GWCC-ACT-${index}`,name,email:state==='needs_email'?'':`activation${index}@example.test`,state,reason:state==='review'?'This account needs administrator review.':null}));
  for(const row of activationRows)data.members.push({...sampleMember,id:row.id,member_id:row.member_id,first_name:row.name.split(' ')[0],last_name:row.name.split(' ').slice(1).join(' '),email:row.email,auth_user_id:null,is_archived:false,updated_at:now});
  await context.addInitScript(watchSyncStatus);
  await context.addInitScript(({session})=>{localStorage.setItem('gwcc_supabase_url','https://gwcc-e2e.supabase.co');localStorage.setItem('gwcc_supabase_anon_key','synthetic-public-key');localStorage.setItem('gwcc-church-auth-token',JSON.stringify(session));},{session});
  await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url()),headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','content-type':'application/json'};
    if(url.origin===origin){if(url.pathname==='/api/staff'){const body=req.postDataJSON();accountActions.push(body);assert.equal(body.action,'member_access');const member=data.members.find(row=>row.id===body.member_id);await route.fulfill({status:200,headers,json:{access:{member:{id:member.id,name:`${member.first_name} ${member.last_name}`,member_id:member.member_id},account:null,state:'unlinked',email:body.email||member.email,message:'Synthetic account check; no invitation sent.'}}});return;}await route.continue();return;}
    if(url.origin!=='https://gwcc-e2e.supabase.co'){await route.abort();return;}
    if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
    let result=[];
    if(url.pathname==='/auth/v1/user')result=user;
    else if(url.pathname==='/auth/v1/token')result=session;
    else if(url.pathname==='/rest/v1/rpc/gwcc_security_status')result={role:profile.role,required:true,verified_factors:1,satisfied:true};
    else if(url.pathname==='/rest/v1/rpc/gwcc_member_activation_overview'){
      assert.equal(profile.role,'super_admin');
      if(activationError){await route.fulfill({status:503,headers,json:{message:'Synthetic unavailable'}});return;}
      result={generated_at:now,members:activationEmpty?[]:activationRows};
    }else if(url.pathname==='/rest/v1/rpc/gwcc_apply_mutations'){
      const body=req.postDataJSON();requests.push(structuredClone(body));
      if(failCloud){await route.fulfill({status:503,headers,json:{message:'Synthetic cloud unavailable'}});return;}
      result=body.p_changes.filter(c=>c.table!=='audit_logs').map(change=>{
        const table=change.table;data[table]||=[];
        if(change.operation==='delete'){data[table]=data[table].filter(row=>row.id!==change.id);return {table,id:change.id,deleted:true};}
        const record={...change.record,updated_at:new Date().toISOString()};data[table]=[record,...data[table].filter(row=>row.id!==record.id)];return {table,record};
      });
    }else if(url.pathname.startsWith('/rest/v1/')){
      const table=url.pathname.split('/').at(-1),namespace=url.searchParams.get('namespace')?.replace(/^eq\./,'');
      const rows=table==='gwcc_documents'?(data[namespace]||[]).map(row=>({id:row.id,namespace,data:row,updated_at:row.updated_at})):(data[table]||[]);
      const offset=Number(url.searchParams.get('offset')||0);result=rows.slice(offset,offset+500);
      if(req.headers().accept?.includes('vnd.pgrst.object'))result=result[0]||null;
    }
    await route.fulfill({status:200,headers,json:result});
  });
  const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  const breakStorage=()=>page.evaluate(()=>{window.__OPS_PUT__||=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,...args){if(this.name==='outboxes'&&value.batches?.length)throw new DOMException('Synthetic storage full','QuotaExceededError');return window.__OPS_PUT__.call(this,value,...args);};});
  const restoreStorage=()=>page.evaluate(()=>{IDBObjectStore.prototype.put=window.__OPS_PUT__;});
  try {
    if(!process.env.TEST_ACTIVATION_ONLY){
    await page.goto(origin+'/members');await page.getByRole('button',{name:'Foundation School',exact:false}).first().click();
    await waitForSync(page);await breakStorage();
    await page.getByRole('button',{name:'Graduate & Certify',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'Synthetic storage full'}).first().waitFor();
    assert.equal(data.foundation_students.find(row=>row.id==='student-0').status,'in_progress');assert.equal(data.members[0].membership_class_completed,false);
    await page.getByRole('button',{name:'Graduate & Certify',exact:true}).waitFor();await restoreStorage();
    const graduateAck=page.waitForResponse(res=>res.url().endsWith('/rpc/gwcc_apply_mutations')&&res.request().postDataJSON()?.p_changes.some(c=>c.table==='foundation_students'&&c.id==='student-0'));
    await page.getByRole('button',{name:'Graduate & Certify',exact:true}).click();await graduateAck;await waitForSync(page);
    assert.equal(data.members.find(row=>row.id==='student-member').membership_class_completed,true);
    const graduation=requests.find(body=>body.p_changes.some(c=>c.table==='foundation_students'&&c.id==='student-0'));
    assert.ok(graduation.p_changes.some(c=>c.table==='members'&&c.id==='student-member'&&c.record.membership_class_completed));
    const repairAck=page.waitForResponse(res=>res.url().endsWith('/rpc/gwcc_apply_mutations')&&res.request().postDataJSON()?.p_changes.some(c=>c.table==='members'&&c.id==='old-graduate'));
    await page.getByRole('button',{name:'Update member completion',exact:true}).click();await repairAck;await waitForSync(page);
    assert.equal(data.foundation_students.find(row=>row.id==='student-1').certificate_no,'ORIGINAL-CERTIFICATE');assert.equal(data.foundation_students.find(row=>row.id==='student-1').graduation_date,'2020-01-01');
    await page.goto(origin+'/inventory');await page.getByRole('button',{name:/Register.*Asset/}).first().click();
    const assetForm=page.locator('form');await assetForm.getByPlaceholder('e.g. Yamaha Motif XF8 88-Key Synthesizer').fill('Synthetic retry asset');await assetForm.getByPlaceholder('0.00',{exact:true}).fill('200');await assetForm.getByPlaceholder('e.g. Brother Kwame Mensah, Elder Kofi Addo').fill('Synthetic Custodian');
    await waitForSync(page);await breakStorage();await page.getByRole('button',{name:'Register Asset',exact:true}).click();
    await assetForm.getByRole('alert').waitFor();assert.equal(await page.getByText('Asset Registered',{exact:true}).count(),0);assert.equal(data.assets.length,0);
    await assetForm.getByPlaceholder('e.g. Yamaha Motif XF8 88-Key Synthesizer').fill('Changed after failure');await page.getByRole('button',{name:'Register Asset',exact:true}).click();await assetForm.getByRole('alert').filter({hasText:'earlier change'}).waitFor();
    await assetForm.getByPlaceholder('e.g. Yamaha Motif XF8 88-Key Synthesizer').fill('Synthetic retry asset');await restoreStorage();failCloud=true;
    await page.getByRole('button',{name:'Register Asset',exact:true}).click();await page.getByRole('heading',{name:'Register Church Asset / Equipment',exact:true}).waitFor({state:'hidden'});
    await page.getByText('Saved on this device; awaiting cloud confirmation.',{exact:true}).first().waitFor();
    const saved=await readSavedOutbox(page,owner),assetBatch=saved.batches.find(batch=>batch.changes.some(change=>change.table==='assets'));
    assert.ok(assetBatch);assert.equal(data.assets.length,0);
    await page.reload();await page.getByText('Synthetic retry asset',{exact:true}).first().waitFor();failCloud=false;await page.getByRole('button',{name:'Retry sync',exact:true}).click();await waitForSync(page);
    assert.equal(data.assets.length,1);const attempts=requests.filter(body=>body.p_changes.some(c=>c.table==='assets'));for(const attempt of attempts)assert.deepEqual(attempt,attempts[0]);
    }
    await page.goto(origin+'/members');await page.getByRole('button',{name:'Portal activation',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Member portal activation',exact:true});await dialog.getByText('Synthetic review only').waitFor({state:'hidden'});
    await dialog.getByRole('list',{name:'Member activation list'}).waitFor();assert.equal(accountActions.length,0);
    await dialog.getByRole('button',{name:'Review portal access for New Member',exact:true}).click();const review=page.getByRole('dialog',{name:'Member Portal Access',exact:true});await review.getByRole('button',{name:'Check account status',exact:true}).click();await review.getByText('Synthetic account check; no invitation sent.',{exact:true}).waitFor();assert.equal(accountActions.length,1);await review.getByRole('button',{name:'Close portal access',exact:true}).click();await dialog.getByRole('list',{name:'Member activation list'}).waitFor();
    for(const label of ['Needs email','Not invited','Needs linking','Invitation pending','Ready to sign in','Needs review'])await dialog.getByRole('button',{name:new RegExp(label)}).waitFor();
    await dialog.getByRole('button',{name:/Invitation pending/}).click();await dialog.getByText('Pending Member',{exact:false}).first().waitFor();assert.equal(await dialog.getByRole('listitem').count(),1);
    await dialog.getByRole('button',{name:/All members/}).click();await dialog.getByLabel('Search activation list').fill('Verified Member');assert.equal(await dialog.getByRole('listitem').count(),1);await dialog.getByLabel('Search activation list').fill('');
    await page.setViewportSize({width:390,height:844});await dialog.screenshot({path:'/tmp/gwcc-activation-mobile.png'});const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+2).slice(0,8).map(el=>({tag:el.tagName,classes:el.className,width:el.getBoundingClientRect().width,right:el.getBoundingClientRect().right}))}));if(layout.scroll>layout.width+2)console.error('Mobile overflow:',JSON.stringify(layout));assert.ok(layout.scroll<=layout.width+2);
    activationError=true;await dialog.getByRole('button',{name:'Refresh status',exact:true}).click();await dialog.getByRole('alert').waitFor();assert.equal(await dialog.getByRole('list',{name:'Member activation list'}).count(),0);
    activationError=false;activationEmpty=true;await dialog.getByRole('button',{name:'Refresh status',exact:true}).click();await dialog.getByText('No members match this selection.',{exact:true}).waitFor();
    await dialog.getByRole('button',{name:'Close member activation',exact:true}).click();profile.role='administrator';await page.reload();await page.locator('main').waitFor();assert.equal(await page.getByRole('button',{name:'Portal activation',exact:true}).count(),0);
    assert.deepEqual(errors,[]);assert.ok(accountActions.every(action=>action.action==='member_access'));
    console.info('Operations/activation checks passed: atomic graduation and historical repair, storage-failure form retention, immutable asset retry across reload, correct activation filters/errors/empty states, mobile layout and restricted access; no email sent.');
  } catch(error){console.error('Operations browser diagnostic:',await page.locator('body').innerText().catch(()=>''));throw error;} finally {await context.close();}
}
