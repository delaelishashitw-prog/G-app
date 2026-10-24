import assert from 'node:assert/strict';
import {readSavedOutbox,watchSyncStatus} from './sync-browser-utils.mjs';

export async function checkMemberDirectory(browser,{origin,settings,sampleMember}) {
 const waitForSync=page=>page.waitForFunction(()=>window.__GWCC_TEST_SYNC_STATUS__?.success===true&&window.__GWCC_TEST_SYNC_STATUS__?.pending===0,null,{timeout:15000});
 let stage='initial';
 const watchdog=setTimeout(()=>{console.error('Member directory check exceeded its deadline at '+stage);process.exit(1);},120000);
 const close=async context=>{let timer;try{await Promise.race([context.close(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Context close timed out at '+stage)),5000);})]);}finally{clearTimeout(timer);}};
 const errors=[],owner='99999999-9999-4999-8999-999999999999';
 const makeMembers=()=>Array.from({length:31},(_,i)=>({...sampleMember,id:'synthetic-directory-'+i,member_id:'GWCC-'+String(900001+i),tithe_number:'T-'+(900001+i),first_name:i===0?'Alpha':i===29?'=1+1':'Registry'+String(i).padStart(2,'0'),last_name:'Person',phone:'024'+String(1000000+i),email:'synthetic'+i+'@example.test',national_id:'',profile_photo_url:'',notes:'',date_of_birth:'1990-01-01',membership_date:'2020-01-01',date_joined:'2020-01-01',updated_at:'2026-10-20T00:00:00Z',status:'active',is_archived:i===30,auth_user_id:null}));
 async function fixture(role='super_admin',width=1440) {
  const exp=Math.floor(Date.now()/1000)+3600,user={id:owner,email:'review@example.test',email_confirmed_at:'2026-10-01T00:00:00Z',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{}};
  const profile={id:owner,email:user.email,role,first_name:'Synthetic',last_name:'Reviewer',is_active:true,has_login_account:true,authorization_reviewed_at:'2026-10-01T00:00:00Z'};
  const token=Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:owner,role:'authenticated',exp})).toString('base64url')+'.test-signature';
  const session={user,access_token:token,refresh_token:'synthetic-only',expires_at:exp,expires_in:3600,token_type:'bearer'};
  const tables={members:makeMembers(),profiles:[profile],settings:[{id:'gwcc_global_settings',...settings}],foundation_cohorts:[{id:'cohort',name:'Synthetic foundation',status:'ongoing',instructor_name:'Synthetic instructor',created_at:'2026-10-01T00:00:00Z'}]},writes=[],receipts=new Map();
  let rejectWrites=false,loseReply=false,nextNumber=990001;
  const context=await browser.newContext({viewport:{width,height:1000},timezoneId:'Africa/Accra'});
  await context.addInitScript(watchSyncStatus);
  await context.addInitScript(({session})=>{localStorage.setItem('gwcc_supabase_url','https://gwcc-e2e.supabase.co');localStorage.setItem('gwcc_supabase_anon_key','test-public-key');localStorage.setItem('gwcc-church-auth-token',JSON.stringify(session));localStorage.setItem('gwcc_member_demographics_open','false');},{session});
  await context.route('https://gwcc-e2e.supabase.co/**',async route=>{
   const req=route.request(),url=new URL(req.url()),headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','content-type':'application/json'};
   if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
   let data=[];
   if(url.pathname==='/auth/v1/user')data=user;
   else if(url.pathname==='/auth/v1/token')data=session;
   else if(url.pathname==='/rest/v1/rpc/gwcc_security_status'){const required=['super_admin','senior_pastor','administrator','finance_officer'].includes(role);data={role,required,verified_factors:required?1:0,satisfied:true};}
   else if(url.pathname==='/rest/v1/rpc/gwcc_apply_mutations') {
    const body=req.postDataJSON();writes.push(structuredClone(body));
    if(rejectWrites){await route.fulfill({status:400,headers,json:{message:'Synthetic cloud unavailable; changes retained.'}});return;}
    if(!['super_admin','senior_pastor','administrator','pastor','data_entry'].includes(role)){await route.fulfill({status:403,headers,json:{message:'Not authorized to change members'}});return;}
    const cached=receipts.get(body.p_operation_id);
    if(cached){assert.deepEqual(cached.request,body);data=cached.result;}
    else {
     data=body.p_changes.map(change=>{
      const previous=tables[change.table]?.find(row=>row.id===change.id);
      const record={...change.record,updated_at:new Date().toISOString()};
      if(change.table==='members'&&!previous){record.member_id='GWCC-'+nextNumber;record.tithe_number='T-'+nextNumber++;}
      return {table:change.table,record};
     });
     for(const row of data){tables[row.table]??=[];tables[row.table]=[row.record,...tables[row.table].filter(item=>item.id!==row.record.id)];}
     receipts.set(body.p_operation_id,{request:structuredClone(body),result:structuredClone(data)});
    }
    if(loseReply&&body.p_changes.some(change=>change.table==='members')){loseReply=false;await route.fulfill({status:500,headers,json:{message:'Synthetic confirmation interrupted'}});return;}
   } else if(url.pathname.startsWith('/rest/v1/')) {
    const table=url.pathname.split('/').at(-1),namespace=url.searchParams.get('namespace')?.replace(/^eq\./,''),range=req.headers().range?.split('-').map(Number),offset=Number(url.searchParams.get('offset')||range?.[0]||0),limit=Number(url.searchParams.get('limit')||500);
    const rows=table==='gwcc_documents'?(tables[namespace]||[]).map(row=>({id:row.id,namespace,data:row,updated_at:row.updated_at})):(tables[table]||[]);
    data=req.headers().accept?.includes('vnd.pgrst.object')?rows[0]||null:rows.slice(offset,offset+limit);
   }
   await route.fulfill({status:200,headers,json:data});
  });
  const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  return {context,page,tables,writes,reject:value=>{rejectWrites=value;},loseNextReply:()=>{loseReply=true;}};
 }
 const open=async(f,path='/members')=>{await f.page.goto(origin+path);await f.page.getByRole('heading',{name:'Member Directory & Profiles',exact:true}).waitFor();await f.page.getByText(/Alpha Person|Registry23 Person/,{exact:true}).first().waitFor();};
 const search=f=>f.page.getByPlaceholder('Search name, GWCC-ID, Tithe #, phone, GPS...');
 const card=(f,name)=>f.page.getByRole('article',{name,exact:true});
 const select=(f,name)=>f.page.getByRole('checkbox',{name:'Select '+name,exact:true}).check();
 const failStorage=page=>page.evaluate(()=>{window.__memberOriginalPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,...rest){if(this.name==='outboxes'&&value.batches?.length)throw new DOMException('Synthetic member storage unavailable','QuotaExceededError');return window.__memberOriginalPut.call(this,value,...rest);};});
 const restoreStorage=page=>page.evaluate(()=>{IDBObjectStore.prototype.put=window.__memberOriginalPut;});
 const register=async(f,first,last)=>{await f.page.getByRole('button',{name:'Add Member',exact:true}).click();const modal=f.page.getByRole('dialog',{name:'Register church member',exact:true});await modal.getByPlaceholder('e.g. Kwame',{exact:true}).fill(first);await modal.getByPlaceholder('e.g. Mensah',{exact:true}).fill(last);await modal.getByRole('button',{name:'2. Contact & Address',exact:true}).click();await modal.getByPlaceholder('+233 24 123 4567',{exact:true}).fill('0240000123');return modal;};
 let f=await fixture();
 try {
  if(!process.env.TEST_DIRECTORY_ROLES_ONLY) {
  await open(f);assert.equal(await f.page.getByRole('checkbox').count(),24);
  await f.page.getByRole('button',{name:/^Archived\s+1$/}).click();await card(f,'Registry30 Person').waitFor();
  assert.equal(await f.page.getByRole('heading',{name:'No members found',exact:true}).count(),0);
  await card(f,'Registry30 Person').getByRole('button',{name:'Restore member to active congregation',exact:true}).click();await card(f,'Registry30 Person').waitFor({state:'hidden'});await waitForSync(f.page);
  assert.equal(f.tables.members.find(row=>row.id==='synthetic-directory-30').is_archived,false);
  await f.page.getByRole('button',{name:'Reset Filters',exact:true}).click();
  await search(f).fill('NoSuchName 900001');await f.page.getByRole('heading',{name:'No members found',exact:true}).waitFor();
  await search(f).fill('Alpha 900001');await card(f,'Alpha Person').waitFor();
  await f.page.getByRole('button',{name:'Reset Filters',exact:true}).click();
  const downloadReady=f.page.waitForEvent('download');await f.page.getByRole('button',{name:'Export Excel',exact:true}).click();const download=await downloadReady,parts=[];for await(const part of await download.createReadStream())parts.push(part);
  const csv=Buffer.concat(parts).toString('utf8');assert.ok(csv.includes('"\'=1+1"'));assert.ok(!csv.includes(',"=1+1",'));assert.ok(csv.includes('Cloud Confirmation'));
  await select(f,'Alpha Person');await search(f).fill('Registry01');await card(f,'Registry01 Person').waitFor();
  await f.page.getByRole('button',{name:/Archive Selected/}).waitFor({state:'hidden'});
  await f.page.getByRole('button',{name:'Reset Filters',exact:true}).click();
  await f.page.goto(origin+'/members?page=2');await f.page.getByText('Page 2 of 2',{exact:true}).first().waitFor();assert.equal(new URL(f.page.url()).searchParams.get('page'),'2');
  await f.page.getByRole('button',{name:'First page',exact:true}).first().click();
  await select(f,'Alpha Person');await select(f,'Registry01 Person');
  const before=f.writes.length;await f.page.getByRole('button',{name:'Archive Selected (2)',exact:true}).click();const review=f.page.getByRole('dialog',{name:'Review selected members to archive',exact:true});
  await review.getByText(/Alpha Person/).waitFor();await review.getByText(/Registry01 Person/).waitFor();assert.equal(f.writes.length,before);
  await failStorage(f.page);await review.getByRole('button',{name:'Archive 2 selected members',exact:true}).click();await review.getByRole('alert').filter({hasText:'Synthetic member storage unavailable'}).waitFor();
  assert.equal(f.tables.members.filter(row=>row.is_archived).length,0);await restoreStorage(f.page);
  await review.getByRole('button',{name:'Archive 2 selected members',exact:true}).click();await review.waitFor({state:'hidden'});await waitForSync(f.page);
  assert.deepEqual(f.tables.members.filter(row=>row.is_archived).map(row=>row.id).sort(),['synthetic-directory-0','synthetic-directory-1']);
  assert.ok(f.writes.some(body=>body.p_changes.filter(change=>change.table==='members').length===2),'Bulk archives use one durable batch');
  console.info('Directory phase complete');await close(f.context);f=await fixture();await open(f);await waitForSync(f.page);
  await failStorage(f.page);let modal=await register(f,'Storage','Saved');
  await modal.getByRole('button',{name:'Register Church Member',exact:true}).click();await modal.getByRole('alert').filter({hasText:'Synthetic member storage unavailable'}).waitFor();
  await modal.getByRole('button',{name:'1. Bio & Biodata',exact:true}).click();assert.equal(await modal.getByPlaceholder('e.g. Kwame',{exact:true}).inputValue(),'Storage');
  assert.equal(f.writes.filter(body=>body.p_changes.some(change=>change.table==='members')).length,0);assert.equal((await readSavedOutbox(f.page,owner)).batches.length,0);
  await restoreStorage(f.page);f.reject(true);await modal.getByRole('button',{name:'Register Church Member',exact:true}).evaluate(button=>{button.click();button.click();});await modal.waitFor({state:'hidden'});
  await f.page.getByText('Synthetic cloud unavailable; changes retained.',{exact:false}).first().waitFor();await f.page.getByText('Saved on this device. Awaiting cloud confirmation.',{exact:true}).first().waitFor();
  const pending=await readSavedOutbox(f.page,owner),memberBatch=pending.batches.find(batch=>batch.changes.some(change=>change.table==='members'));
  assert.ok(memberBatch);const savedId=memberBatch.changes.find(change=>change.table==='members').id;
  await f.page.reload();await f.page.getByText('Storage Saved',{exact:true}).first().waitFor();f.reject(false);await f.page.getByRole('button',{name:'Retry sync',exact:true}).click();await waitForSync(f.page);
  await f.page.getByText('GWCC-990001',{exact:true}).first().waitFor({timeout:5000});assert.equal(f.tables.members.filter(row=>row.id===savedId).length,1);assert.equal(f.tables.members.filter(row=>row.first_name==='Storage').length,1);
  const retries=f.writes.filter(body=>body.p_operation_id===memberBatch.id);assert.ok(retries.length>=2);assert.deepEqual(retries.at(-1),retries[0]);
  await f.page.getByRole('button',{name:'Back to Members',exact:true}).click();
  f.loseNextReply();modal=await register(f,'Interrupted','Member');await modal.getByRole('button',{name:'Register Church Member',exact:true}).click();
  await f.page.getByText('Synthetic confirmation interrupted',{exact:false}).first().waitFor();await f.page.reload();await waitForSync(f.page);
  assert.equal(f.tables.members.filter(row=>row.first_name==='Interrupted').length,1,'Lost confirmations cannot create a second member');
  console.info('Directory phase complete');await close(f.context);f=await fixture();await open(f);await waitForSync(f.page);
  stage='editing';console.info('Directory: edit retry checks starting');
  await card(f,'Alpha Person').getByRole('button',{name:'Edit Details',exact:true}).click();modal=f.page.getByRole('dialog',{name:'Edit church member',exact:true});
  await modal.getByPlaceholder('e.g. Kwame',{exact:true}).fill('Alpha Edited');await failStorage(f.page);await modal.getByRole('button',{name:'Save Changes',exact:true}).click();
  await modal.getByRole('alert').filter({hasText:'Synthetic member storage unavailable'}).waitFor();assert.equal(await modal.getByPlaceholder('e.g. Kwame',{exact:true}).inputValue(),'Alpha Edited');assert.equal(f.tables.members.find(row=>row.id==='synthetic-directory-0').first_name,'Alpha');
  await restoreStorage(f.page);await modal.getByRole('button',{name:'Save Changes',exact:true}).click();await modal.waitFor({state:'hidden'});await waitForSync(f.page);assert.equal(f.tables.members.find(row=>row.id==='synthetic-directory-0').first_name,'Alpha Edited');
  stage='bulk edit';console.info('Directory: bulk edit checks starting');
  await select(f,'Alpha Edited Person');await select(f,'Registry01 Person');await f.page.getByRole('button',{name:'Bulk Operations (2)',exact:true}).click();
  modal=f.page.getByRole('dialog',{name:'Bulk member operations',exact:true});await modal.getByRole('button',{name:/^Update Status/}).click();
  await failStorage(f.page);await modal.getByRole('button',{name:'Apply to 2 Members',exact:true}).click();await modal.getByRole('alert').filter({hasText:'Synthetic member storage unavailable'}).waitFor();
  await restoreStorage(f.page);await modal.getByRole('button',{name:'Apply to 2 Members',exact:true}).click();await modal.waitFor({state:'hidden'});await waitForSync(f.page);
  await select(f,'Alpha Edited Person');await select(f,'Registry01 Person');await f.page.getByRole('button',{name:'Bulk Operations (2)',exact:true}).click();modal=f.page.getByRole('dialog',{name:'Bulk member operations',exact:true});
  stage='cohort';console.info('Directory: cohort checks starting');
  await modal.getByRole('button',{name:/^Foundation School/}).click();await failStorage(f.page);await modal.getByRole('button',{name:'Apply to 2 Members',exact:true}).click();await modal.getByRole('alert').filter({hasText:'Synthetic member storage unavailable'}).waitFor();
  await restoreStorage(f.page);await modal.getByRole('button',{name:'Apply to 2 Members',exact:true}).click();await modal.waitFor({state:'hidden'});await waitForSync(f.page);assert.equal(f.tables.foundation_students.length,2);
  await close(f.context);f=await fixture();await open(f);
  stage='printing';console.info('Directory: print checks starting');
  await f.page.getByRole('button',{name:'Print Directory',exact:true}).click();modal=f.page.getByRole('dialog',{name:'Print congregational membership directory',exact:true});await modal.waitFor();
  await f.page.emulateMedia({media:'print'});assert.equal(await modal.locator('tbody tr').count(),30);
  const printStyles=await modal.evaluate(el=>({maxHeight:getComputedStyle(el).maxHeight,overflow:getComputedStyle(el).overflow,background:getComputedStyle(document.querySelector('#root')).display}));
  assert.deepEqual(printStyles,{maxHeight:'none',overflow:'visible',background:'none'});
  for(const member of f.tables.members.filter(row=>!row.is_archived))await modal.getByText(member.member_id,{exact:true}).waitFor();
  if(process.env.TEST_MEMBER_DIRECTORY_PDF)await f.page.pdf({path:process.env.TEST_MEMBER_DIRECTORY_PDF,format:'A4',preferCSSPageSize:true,printBackground:true});
  await f.page.emulateMedia({media:'screen'});await modal.getByRole('button',{name:'Close directory preview',exact:true}).click();
  assert.equal(await f.page.evaluate(()=>document.body.classList.contains('member-directory-print-open')),false);
  if(process.env.TEST_MEMBER_DIRECTORY_DESKTOP)await f.page.screenshot({path:process.env.TEST_MEMBER_DIRECTORY_DESKTOP});
  await close(f.context);
  } else await close(f.context);
  stage='roles';
  for(const role of ['finance_officer','attendance_officer','ministry_leader','data_entry','pastor']) {
   stage='role '+role;console.info('Directory: checking '+role);
   f=await fixture(role,390);await open(f);const editable=['data_entry','pastor'].includes(role);
   assert.equal(await f.page.getByRole('button',{name:'Add Member',exact:true}).count(),editable?1:0,role);
   assert.equal(await card(f,'Alpha Person').getByRole('button',{name:'Edit Details',exact:true}).count(),editable?1:0,role);
   assert.equal(await card(f,'Alpha Person').getByRole('button',{name:'Archive Member',exact:true}).count(),0,role);
   assert.ok(await f.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),role+' mobile overflow');
   if(role==='finance_officer'&&process.env.TEST_MEMBER_DIRECTORY_MOBILE)await f.page.screenshot({path:process.env.TEST_MEMBER_DIRECTORY_MOBILE});
   assert.equal(f.writes.length,0);await close(f.context);
  }
  assert.deepEqual(errors,[]);
  console.info('Member directory checks passed: durable registration/edit/bulk failure retry, exact lost-response retry, archive restoration and confirmation, consistent selections, restricted roles, mixed search, shared pagination, safe Excel cells, complete isolated printing, cohort batch admission and mobile/desktop layout.');
 }catch(err){
  console.error('Member directory failure at '+stage,err);
  console.error('Directory screen',f.page.url(),(await f.page.locator('body').innerText({timeout:2000})).slice(0,2400));
  throw err;
 }finally{try{await close(f.context);}finally{clearTimeout(watchdog);}}
}
