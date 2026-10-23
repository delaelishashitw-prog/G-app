import assert from 'node:assert/strict';
import {watchSyncStatus,waitForSync,readSavedOutbox} from './sync-browser-utils.mjs';

export async function checkAppReviewCorrections(browser,{origin,settings,sampleMember}){
 const actor='31313131-3131-4131-8131-313131313131',memberActor='32323232-3232-4232-8232-323232323232';
 const now=new Date().toISOString(),today=now.slice(0,10),bank={id:'review-bank',name:'Synthetic Bank Account',account_type:'bank',account_number:'000000000123',bank_or_provider:'Synthetic Bank',currency:'GHS',is_active:true,current_balance:100,opening_balance:100,created_at:now,updated_at:now};
 let approved=null,losePublication=true;const publicationReceipts=new Map(),publicationRequests=[];
 const channel=()=>approved?.enabled?[{id:bank.id,account_type:bank.account_type,account_number:bank.account_number,bank_or_provider:bank.bank_or_provider,currency:bank.currency,account_name:approved.account_name}]:[];
 const data={profiles:[],settings:[{id:'gwcc_global_settings',...settings}],members:[{...sampleMember,id:'review-person',member_id:'GWCC-REVIEW',first_name:'Synthetic',last_name:'Member',auth_user_id:memberActor,is_archived:false,status:'active'}],small_groups:[{id:'review-cell',name:'Synthetic Cell',leader_name:'Synthetic Leader',meeting_location:'Synthetic address',meeting_address:'Synthetic address',zone:'Synthetic Zone',meeting_day:'Wednesday',meeting_time:'19:00',member_count:0}],church_accounts:[bank],pledges:[{id:'review-pledge',member_id:'review-person',member_name:'Synthetic Member',member_phone:'0240000001',campaign_id:'review-campaign',campaign_name:'Synthetic Project',amount_pledged:100,amount_paid:0,balance:100,status:'active',date:today,due_date:'2099-12-31',currency:'GHS',created_at:now,updated_at:now}],pledge_campaigns:[{id:'review-campaign',name:'Synthetic Project',target_amount:1000,is_active:true,start_date:today}],gwcc_documents:[]};
 async function setup(role='super_admin',width=1440){
  const id=role==='member'?memberActor:actor,profile={id,email:'review@example.test',first_name:'Synthetic',last_name:'Reviewer',role,is_active:true,has_login_account:true,authorization_reviewed_at:now};
  const user={id,email:profile.email,email_confirmed_at:now,role:'authenticated',aud:'authenticated',app_metadata:{provider:'email'},user_metadata:{}};
  const exp=Math.floor(Date.now()/1000)+3600,token=`${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,role:'authenticated',aal:'aal2',session_id:id,exp})).toString('base64url')}.synthetic-signature`;
  const session={user,access_token:token,refresh_token:'synthetic-review-refresh',expires_at:exp,expires_in:3600,token_type:'bearer'};
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'}),mutations=[],errors=[];let rejectWrites=true,failAuth=false;
  await context.addInitScript(watchSyncStatus);
  await context.addInitScript(({session})=>{localStorage.setItem('gwcc_supabase_url','https://gwcc-e2e.supabase.co');localStorage.setItem('gwcc_supabase_anon_key','synthetic-public-key');localStorage.setItem('gwcc-church-auth-token',JSON.stringify(session));localStorage.setItem('gwcc_momo_number','0999999999');localStorage.setItem('gwcc_bank_account','unconfirmed-device-only-number');},{session});
  await context.route('https://gwcc-e2e.supabase.co/**',async route=>{
   const req=route.request(),url=new URL(req.url()),headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','content-type':'application/json'};
   if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
   const reject=(status,message)=>route.fulfill({status,headers,body:JSON.stringify({message})});let result=[];
   if(url.pathname==='/auth/v1/user'){if(failAuth){await route.abort('internetdisconnected');return;}result=user;}
   else if(url.pathname==='/auth/v1/token')result=session;
   else if(url.pathname==='/rest/v1/rpc/gwcc_security_status')result={role,required:role!=='member',verified_factors:role==='member'?0:1,satisfied:true};
   else if(url.pathname==='/rest/v1/rpc/gwcc_giving_channels')result=channel();
   else if(url.pathname==='/rest/v1/rpc/gwcc_giving_channel_accounts'){
    assert.ok(['super_admin','senior_pastor','finance_officer'].includes(role));result=[{...channel()[0],id:bank.id,account_type:bank.account_type,account_number:bank.account_number,bank_or_provider:bank.bank_or_provider,currency:bank.currency,label:bank.name,is_active:true,account_version:bank.updated_at,channel_version:approved?.updated_at||null,enabled:Boolean(approved?.enabled),approved:Boolean(approved?.enabled),account_name:approved?.account_name||''}];
   }else if(url.pathname==='/rest/v1/rpc/gwcc_set_giving_channel'){
    const body=req.postDataJSON();publicationRequests.push(body);
    if(publicationReceipts.has(body.p_operation_id)){assert.deepEqual(body,publicationReceipts.get(body.p_operation_id).body);result=publicationReceipts.get(body.p_operation_id).result;}
    else{assert.equal(body.p_account_id,bank.id);assert.equal(body.p_account_version,bank.updated_at);approved={account_id:bank.id,account_name:body.p_account_name,enabled:body.p_enabled,updated_at:new Date().toISOString()};result=approved;publicationReceipts.set(body.p_operation_id,{body:structuredClone(body),result:structuredClone(result)});if(losePublication){losePublication=false;await reject(503,'Synthetic interrupted confirmation. Retry the same request.');return;}}
   }else if(url.pathname==='/rest/v1/rpc/gwcc_apply_mutations'){
    const body=req.postDataJSON();mutations.push(body);
    if(rejectWrites){await reject(503,'Synthetic cloud unavailable; queued changes retained.');return;}
    assert.ok(!body.p_changes.some(change=>change.table==='pastoral_counseling'));
    result=body.p_changes.filter(change=>change.table!=='audit_logs').map(change=>{
     if(change.operation==='delete')return {table:change.table,id:change.id,deleted:true};
     const record={...change.record,updated_at:new Date().toISOString()};
     if(['cell_meeting_reports','counseling_sessions'].includes(change.table)){
      const doc={namespace:change.table,id:record.id,data:record};data.gwcc_documents=[doc,...data.gwcc_documents.filter(row=>row.id!==doc.id||row.namespace!==doc.namespace)];
     }else data[change.table]=[record,...(data[change.table]||[]).filter(row=>row.id!==record.id)];
     return {table:change.table,record};
    });
   }else if(url.pathname==='/rest/v1/profiles')result=req.headers().accept?.includes('vnd.pgrst.object')?profile:[profile];
   else if(url.pathname.startsWith('/rest/v1/')){
    let rows=data[url.pathname.split('/').at(-1)]||[];
    if(url.searchParams.has('namespace'))rows=rows.filter(row=>row.namespace===url.searchParams.get('namespace').replace(/^eq\./,''));
    const offset=Number(url.searchParams.get('offset')||0);result=rows.slice(offset,offset+500);
    if(req.headers().accept?.includes('vnd.pgrst.object'))result=result[0]||null;
   }
   await route.fulfill({status:200,headers,body:JSON.stringify(result)});
  });
  const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
  return {page,context,mutations,errors,setReject:value=>rejectWrites=value,setFailAuth:value=>failAuth=value};
 }
 const app=await setup();const {page,context}=app;
 try{
  await page.goto(origin+'/small-groups');await page.getByRole('button',{name:'Weekly Meeting Reports (0)',exact:true}).waitFor();
  assert.ok(!(await page.locator('body').innerText()).includes('835.50'));
  await page.getByTitle('Log Weekly Cell Meeting Report',{exact:true}).first().click();
  const form=page.getByRole('form',{name:'Cell meeting report'});await form.locator('input[type=text]').first().fill('Synthetic persistent report');await form.locator('input[type=number]').first().fill('25.50');
  await page.getByRole('button',{name:'Save Meeting Report',exact:true}).click();await page.getByRole('button',{name:'Weekly Meeting Reports (1)',exact:true}).click();await page.getByText('Synthetic persistent report',{exact:true}).waitFor();await page.getByText('Awaiting cloud confirmation',{exact:true}).waitFor();
  const queued=await readSavedOutbox(page,actor);assert.ok(queued.batches.some(batch=>batch.changes.some(change=>change.table==='cell_meeting_reports')));
  await page.reload();await page.getByRole('button',{name:'Weekly Meeting Reports (1)',exact:true}).click();await page.getByText('Synthetic persistent report',{exact:true}).waitFor();
  app.setReject(false);await page.getByRole('button',{name:'Retry sync',exact:true}).click();await waitForSync(page);await page.reload();await page.getByRole('button',{name:'Weekly Meeting Reports (1)',exact:true}).click();await page.getByText('Synthetic persistent report',{exact:true}).waitFor();assert.equal(await page.getByText('Awaiting cloud confirmation',{exact:true}).count(),0);assert.equal(data.gwcc_documents.filter(row=>row.namespace==='cell_meeting_reports').length,1);

  await page.goto(origin+'/events');await page.getByRole('button',{name:'Schedule Program',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Schedule Program',exact:true}).isEnabled(),true);
  await page.goto(origin+'/pastoral-care');await page.getByRole('button',{name:'Schedule Counseling',exact:true}).click();await page.getByLabel('Counselee',{exact:true}).selectOption('review-person');await page.locator('form').filter({has:page.getByRole('button',{name:'Save Counseling Session',exact:true})}).locator('textarea').first().fill('Synthetic counseling discussion');const counselingSent=page.waitForRequest(request=>request.url().endsWith('/rpc/gwcc_apply_mutations')&&request.postDataJSON()?.p_changes?.some(change=>change.table==='counseling_sessions'));await page.getByRole('button',{name:'Save Counseling Session',exact:true}).click();await counselingSent;await waitForSync(page);assert.ok(app.mutations.some(body=>body.p_changes.some(change=>change.table==='counseling_sessions')));assert.ok(!app.mutations.some(body=>body.p_changes.some(change=>change.table==='pastoral_counseling')));

  await page.goto(origin+'/pledges');await page.getByTitle('View Pledge Dossier',{exact:true}).first().click();await page.getByText('Pastoral WhatsApp Reminder Generator',{exact:true}).waitFor();assert.ok(!(await page.locator('body').innerText()).includes('1041010098765'));await page.getByText('Contact the church office for confirmed payment instructions.',{exact:false}).waitFor();
  await page.goto(origin+'/church-finance');await page.getByRole('button',{name:'Holding Accounts & Treasury',exact:false}).click();const panel=page.getByRole('region',{name:'Manage official giving channels'});await panel.getByLabel('Receiving church account',{exact:true}).selectOption(bank.id);await panel.getByLabel('Registered account holder name',{exact:true}).fill('Synthetic Approved Church');await panel.getByRole('checkbox').check();await panel.getByRole('button',{name:'Approve giving channel',exact:true}).click();await panel.getByRole('alert').filter({hasText:'Synthetic interrupted confirmation'}).waitFor();assert.equal(await panel.getByLabel('Registered account holder name',{exact:true}).inputValue(),'Synthetic Approved Church');await panel.getByRole('button',{name:'Approve giving channel',exact:true}).click();await panel.getByText('Giving channel approved and saved to the cloud.',{exact:true}).waitFor();assert.deepEqual(publicationRequests[0],publicationRequests[1]);assert.equal(publicationReceipts.size,1);
  await page.goto(origin+'/pledges');await page.getByTitle('View Pledge Dossier',{exact:true}).first().click();await page.getByText('Synthetic Bank: 000000000123 (Synthetic Approved Church; GHS)',{exact:false}).waitFor();

  await page.goto(origin+'/small-groups');await page.getByTitle('Log Weekly Cell Meeting Report',{exact:true}).first().click();await page.getByRole('form',{name:'Cell meeting report'}).locator('input[type=text]').first().fill('Keep this unsaved draft');app.setFailAuth(true);await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.getByText('Connection interrupted. Previously verified records remain available; cloud confirmation requires reconnection.',{exact:true}).waitFor();assert.ok(new URL(page.url()).pathname==='/small-groups');assert.equal(await page.getByRole('form',{name:'Cell meeting report'}).locator('input[type=text]').first().inputValue(),'Keep this unsaved draft');app.setFailAuth(false);await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.getByText('Connection interrupted.',{exact:false}).waitFor({state:'hidden'});assert.equal(await page.getByRole('form',{name:'Cell meeting report'}).locator('input[type=text]').first().inputValue(),'Keep this unsaved draft');
  assert.equal(app.errors.length,0,app.errors.join(' | '));
 }finally{await context.close();}
 const member=await setup('member',390);
 try{
  await member.page.goto(origin+'/portal?tab=giving');await member.page.getByRole('region',{name:'Official giving instructions'}).getByText('000000000123',{exact:true}).waitFor();const text=await member.page.locator('body').innerText();assert.ok(!text.includes('024 456 7890'));assert.ok(!text.includes('1041130009821'));assert.ok(!text.includes('unconfirmed-device-only-number'));
  await member.page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth+2);
  await member.page.reload();await member.page.getByRole('region',{name:'Official giving instructions'}).getByText('000000000123',{exact:true}).waitFor();assert.equal(member.errors.length,0,member.errors.join(' | '));
 }finally{await member.context.close();}
 console.log('App review corrections browser checks passed: real cell reports survive reload and queued retries, no example figures, canonical counseling sync, Super Admin event scheduling, finance-approved shared payment details, exactly-once interrupted publication, member/mobile display, and draft-preserving offline/reconnect checks. No external messages or payments were sent.');
}
