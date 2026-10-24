import assert from 'node:assert/strict';
import {initialSettings,sampleMembers} from '../src/lib/initialData.ts';
import {waitForSync,watchSyncStatus} from './sync-browser-utils.mjs';

export async function checkEvents(browser,{origin}){
const owner='61616161-6161-4161-8161-616161616161',now=new Date().toISOString(),today=now.slice(0,10);
const tomorrowDate=new Date(today+'T12:00:00Z');tomorrowDate.setUTCDate(tomorrowDate.getUTCDate()+1);const tomorrow=tomorrowDate.toISOString().slice(0,10);
async function setup(role='super_admin',width=1440,timeZone='Africa/Accra'){
 const profile={id:owner,email:'events@example.test',first_name:'Synthetic',last_name:'Reviewer',role,is_active:true,has_login_account:true,authorization_reviewed_at:now};
 const user={id:owner,email:profile.email,email_confirmed_at:now,role:'authenticated',aud:'authenticated',app_metadata:{provider:'email'},user_metadata:{}};
 const exp=Math.floor(Date.now()/1000)+3600,token=`${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:owner,role:'authenticated',aal:'aal2',session_id:owner,exp})).toString('base64url')}.synthetic-signature`;
 const session={user,access_token:token,refresh_token:'synthetic-event-review-refresh',expires_at:exp,expires_in:3600,token_type:'bearer'};
 const event=(id,title,type,date)=>({id,title,event_type:type,start_date:date,end_date:date,start_time:'18:00',end_time:'20:00',venue:'Synthetic External Park',status:'upcoming',requires_registration:true,attendees:id==='alpha'?[{id:'att-test',name:'Synthetic Volunteer',checked_in:false,registered_at:now}]:[],registration_count:id==='alpha'?1:0,expected_attendance:50,budget:0,created_at:now,updated_at:now});
 const data={settings:[{id:'gwcc_global_settings',...initialSettings}],members:[{...sampleMembers[0],id:'review-member',member_id:'GWCC-REVIEW',first_name:'Synthetic',last_name:'Member',is_archived:false,auth_user_id:null}],events:[event('alpha','Synthetic Conference Alpha','conference',today),event('beta','Synthetic Youth Beta','youth',tomorrow)],services:[]};
 const context=await browser.newContext({viewport:{width,height:1000},timezoneId:timeZone,reducedMotion:'reduce'}),requests=[],errors=[];let reject=false;
 await context.addInitScript(watchSyncStatus);
 await context.addInitScript(({session})=>{localStorage.setItem('gwcc_supabase_url','https://gwcc-e2e.supabase.co');localStorage.setItem('gwcc_supabase_anon_key','synthetic-public-key');localStorage.setItem('gwcc-church-auth-token',JSON.stringify(session));const originalPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(window.__FAIL_EVENTS_STORAGE__&&this.name==='outboxes')throw new DOMException('Synthetic device storage full','QuotaExceededError');return originalPut.apply(this,args);};},{session});
 await context.route('https://gwcc-e2e.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url()),headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','content-type':'application/json'};
  if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
  let result=[];
  if(url.pathname==='/auth/v1/user')result=user;
  else if(url.pathname==='/auth/v1/token')result=session;
  else if(url.pathname==='/rest/v1/rpc/gwcc_security_status')result={role,required:true,verified_factors:1,satisfied:true};
  else if(url.pathname==='/rest/v1/profiles')result=req.headers().accept?.includes('vnd.pgrst.object')?profile:[profile];
  else if(url.pathname==='/rest/v1/rpc/gwcc_apply_mutations'){
   const body=req.postDataJSON();requests.push(body);
   if(reject){await route.fulfill({status:503,headers,body:JSON.stringify({message:'Synthetic event cloud unavailable; change was not saved'})});return;}
   result=body.p_changes.filter(c=>c.table!=='audit_logs').map(change=>{
    if(change.operation==='delete'){data[change.table]=(data[change.table]||[]).filter(row=>row.id!==change.id);return{table:change.table,id:change.id,deleted:true};}
    const record={...change.record,updated_at:new Date().toISOString()};data[change.table]=[record,...(data[change.table]||[]).filter(row=>row.id!==record.id)];return{table:change.table,record};
   });
  }else if(url.pathname.startsWith('/rest/v1/')){
   let rows=data[url.pathname.split('/').at(-1)]||[];
   if(url.searchParams.has('namespace'))rows=rows.filter(row=>row.namespace===url.searchParams.get('namespace').replace(/^eq\./,''));
   result=rows.slice(Number(url.searchParams.get('offset')||0),Number(url.searchParams.get('offset')||0)+Number(url.searchParams.get('limit')||500));
  }
  await route.fulfill({status:200,headers,body:JSON.stringify(result)});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/events');await page.getByRole('button',{name:'Schedule Program',exact:true}).waitFor();await page.getByText('Synthetic Conference Alpha',{exact:true}).first().waitFor();
 return{context,page,data,requests,errors,rejectWrites:value=>{reject=value;}};
}
 const app=await setup();
 try{
  const {page}=app,detail=()=>page.getByRole('dialog',{name:'Event details',exact:true});
  await page.getByRole('tab',{name:'Youth',exact:true}).click();
  assert.equal(await page.locator('[title="Synthetic Conference Alpha (18:00)"]').count(),0);
  await page.getByPlaceholder('Search programs, speakers, themes, venues...').fill('no-such-event');
  assert.equal(await page.locator('[title="Synthetic Youth Beta (18:00)"]').count(),0);
  await page.getByPlaceholder('Search programs, speakers, themes, venues...').fill('');
  await page.getByRole('tab',{name:'All Programs',exact:true}).click();
  await page.getByRole('button',{name:'Weekly Services',exact:true}).click();
  assert.equal(await page.getByText('Sunday 1st Service',{exact:true}).count(),0);
  await page.getByRole('button',{name:'View Details & Roster',exact:true}).click();
  await detail().getByRole('button',{name:'Edit Program',exact:true}).waitFor();
  assert.equal(await detail().getByText('GPS: GA-184-2900',{exact:true}).count(),0);
  await detail().getByRole('button',{name:/Volunteers & RSVPs/}).click();
  await detail().getByTitle('Click to check in',{exact:true}).click();
  await detail().getByText('Present',{exact:true}).waitFor();await waitForSync(page);
  assert.ok(app.data.events.find(event=>event.id==='alpha').attendees[0].checked_in);
  assert.ok(app.requests.flatMap(request=>request.p_changes).find(change=>change.table==='events').expected_updated_at);
  assert.equal(await detail().getByTitle('Remove from roster',{exact:true}).isDisabled(),true);
  await detail().getByRole('button',{name:'Assign Volunteer / RSVP',exact:true}).click();
  const register=page.getByRole('dialog',{name:'Register Attendee / Volunteer',exact:true});
  await register.getByRole('button',{name:'External Guest / Visitor',exact:true}).click();
  await register.getByLabel('Guest Full Name *',{exact:true}).fill('Synthetic New Guest');
  await register.getByRole('button',{name:'Confirm Registration',exact:true}).click();
  await detail().getByText('Synthetic New Guest',{exact:true}).waitFor();await waitForSync(page);
  assert.equal(app.data.events.find(event=>event.id==='alpha').attendees.length,2);
  await detail().getByTitle('Close',{exact:true}).click();
  await page.getByRole('button',{name:'Schedule Program',exact:true}).click();
  const schedule=()=>page.getByRole('dialog',{name:'Schedule Church Program',exact:true});
  assert.equal(await schedule().getByLabel('Allocated Budget (GH₵)',{exact:true}).inputValue(),'0');
  await schedule().getByLabel('Program / Event Title *',{exact:true}).fill('Synthetic Zero Program');
  await schedule().getByLabel('Expected Attendance',{exact:true}).fill('0');
  app.rejectWrites(true);
  await schedule().getByRole('button',{name:'Schedule Program',exact:true}).click();
  await page.getByText('Program Saved',{exact:true}).waitFor();
  await page.getByText('Synthetic event cloud unavailable; change was not saved',{exact:true}).waitFor();
  const pending=app.requests.flatMap(request=>request.p_changes).find(change=>change.table==='events'&&change.record?.title==='Synthetic Zero Program');
  assert.equal(pending.record.expected_attendance,0);assert.equal(pending.record.budget,0);
  await page.getByRole('button',{name:'Cards',exact:true}).click();
  await page.getByRole('heading',{name:'Synthetic Zero Program',level:3,exact:true}).click();
  await detail().getByText(/Further changes are available after confirmation/).waitFor();
  assert.equal(await detail().getByRole('button',{name:'Edit Program',exact:true}).isDisabled(),true);
  await detail().getByTitle('Close',{exact:true}).click();
  await page.reload();await page.getByRole('button',{name:'Schedule Program',exact:true}).waitFor();
  app.rejectWrites(false);await page.getByRole('button',{name:'Retry sync',exact:true}).click();await waitForSync(page);
  assert.equal(app.data.events.filter(event=>event.title==='Synthetic Zero Program').length,1);
  for(const mode of ['Month Grid','Agenda','Cards']){
    await page.setViewportSize({width:390,height:844});
    await page.getByRole('button',{name:mode,exact:true}).click();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),`Events overflow in ${mode}`);
  }
  await page.getByRole('heading',{name:'Synthetic Conference Alpha',level:3,exact:true}).click();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Event details overflow');
  await detail().getByRole('button',{name:'Edit Program',exact:true}).click();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Event form overflows');
  assert.deepEqual(app.errors,[]);
 }finally{await app.context.close();}
 const full=await setup();
 try{
  const {page}=full;await page.evaluate(()=>{window.__FAIL_EVENTS_STORAGE__=true;});
  await page.getByRole('button',{name:'Schedule Program',exact:true}).click();
  const schedule=page.getByRole('dialog',{name:'Schedule Church Program',exact:true});
  await schedule.getByLabel('Program / Event Title *',{exact:true}).fill('Synthetic Unpreserved Program');
  await schedule.getByRole('button',{name:'Schedule Program',exact:true}).click();
  await schedule.getByText(/Device storage|preserve|storage full/).waitFor();
  assert.equal(await page.getByText('Program Saved',{exact:true}).count(),0);
  assert.equal(await page.getByText('Synthetic Unpreserved Program',{exact:true}).count(),0);
  await page.evaluate(()=>{window.__FAIL_EVENTS_STORAGE__=false;});
  await schedule.getByRole('button',{name:'Schedule Program',exact:true}).click();await waitForSync(page);
  assert.equal(full.data.events.filter(event=>event.title==='Synthetic Unpreserved Program').length,1);
 }finally{await full.context.close();}
 const remote=await setup('super_admin',1440,'America/New_York');
 try{
  const pill=remote.page.locator('[title="Synthetic Conference Alpha (18:00)"]');
  const cell=await pill.evaluate(element=>element.parentElement.parentElement.parentElement.innerText);
  assert.equal(cell.split('\n').find(text=>/^\d+$/.test(text)),String(Number(today.slice(-2))));
 }finally{await remote.context.close();}
 console.log('Events: private drafts, versioned admission, current rosters, zero budget, storage retry, cloud replay, Ghana dates and mobile layout passed.');
}
