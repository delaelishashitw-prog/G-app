import assert from 'node:assert/strict';
const card=(page,title)=>page.getByRole('article').filter({has:page.getByRole('heading',{name:title,exact:true})});
export async function checkTasks(browser,{origin,settings}){
 const today=new Date().toISOString().slice(0,10),yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10),base=today+'T00:00:00Z';
 const actor='25252525-2525-4525-8525-252525252525',colleague='26262626-2626-4626-8626-262626262626';
 async function setup(role='super_admin'){
  const profile={id:actor,email:'tasks-qa@example.test',first_name:'Synthetic',last_name:'Coordinator',role,is_active:true,has_login_account:true,authorization_reviewed_at:base};
  const user={id:actor,email:profile.email,email_confirmed_at:base,role:'authenticated',aud:'authenticated',app_metadata:{provider:'email'},user_metadata:{}};
  const exp=Math.floor(Date.now()/1000)+3600,token=`${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:actor,role:'authenticated',exp,aal:'aal2',session_id:actor})).toString('base64url')}.test-signature`;
  const session={user,access_token:token,refresh_token:'synthetic-tasks-refresh',expires_in:3600,expires_at:exp,token_type:'bearer'};
  const fixture={profiles:[profile],settings:[{id:'gwcc_global_settings',...settings}],members:[],visitors:role==='finance_officer'?[]:[{id:'task-visitor',full_name:'Synthetic Visitor',phone:'0240000001',visit_date:yesterday,service_attended:'Sunday',follow_up_status:'new',notes:'Earlier unstructured note',created_at:base,updated_at:base}],pastoral_care:role==='finance_officer'?[]:[{id:'task-care',member_id:'care-person',member_name:'Pastoral Person',date:yesterday,follow_up_date:yesterday,status:'in_progress',care_type:'general_follow_up',is_confidential:true,notes:'Confidential source note'}]};
  let stamp=0,failList=false,interruptCreate=true;const actions=[],logs=[],errors=[],receipts=new Map(),interactions=[];
  const timestamp=()=>new Date(Date.now()+ ++stamp).toISOString();
  let tasks=[{id:'27272727-2727-4727-8727-272727272727',kind:'general',source_type:'none',title:'Review supplies',description:'Check the supply register',priority:'high',due_date:yesterday,assigned_to_id:actor,assigned_to:'Synthetic Coordinator',status:'open',created_by_id:actor,created_by:'Synthetic Coordinator',created_at:base,updated_at:base,assignee_available:true,history:[{action:'create',actor_id:actor,actor_name:'Synthetic Coordinator',at:base}]}];
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  await context.addInitScript(({session})=>{localStorage.setItem('gwcc_supabase_url','https://gwcc-e2e.supabase.co');localStorage.setItem('gwcc_supabase_anon_key','synthetic-public-key');localStorage.setItem('gwcc-church-auth-token',JSON.stringify(session));},{session});
  await context.route('https://gwcc-e2e.supabase.co/**',async route=>{
   const request=route.request(),url=new URL(request.url()),headers={'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'*'};
   if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
   const reject=async(status,message)=>route.fulfill({status,headers,body:JSON.stringify({message})});let result=[];
   if(url.pathname==='/auth/v1/user')result=user;
   else if(url.pathname==='/auth/v1/token')result=session;
   else if(url.pathname==='/auth/v1/logout'){await route.fulfill({status:204,headers});return;}
   else if(url.pathname==='/rest/v1/rpc/gwcc_security_status')result={role,required:true,verified_factors:1,satisfied:true};
   else if(url.pathname==='/rest/v1/rpc/gwcc_follow_up_list'){
    if(failList){await reject(503,'Synthetic task list unavailable');return;}result=tasks;
   }else if(url.pathname==='/rest/v1/rpc/gwcc_follow_up_people'){
    const kind=request.postDataJSON().p_kind;assert.ok(role!=='finance_officer'||kind==='general');result=[{id:actor,name:'Synthetic Coordinator',role},...(role==='super_admin'?[{id:colleague,name:'Synthetic Pastor',role:'pastor'}]:[])];
   }else if(url.pathname==='/rest/v1/rpc/gwcc_follow_up_action'){
    const body=request.postDataJSON();actions.push(body);const fingerprint=JSON.stringify(body);
    if(receipts.has(body.p_operation_id)){const receipt=receipts.get(body.p_operation_id);assert.equal(receipt.fingerprint,fingerprint);result=tasks.find(row=>row.id===body.p_task_id);}
    else{
     const before=tasks.find(row=>row.id===body.p_task_id),data=body.p_data;
     if(before&&before.updated_at!==body.p_expected_updated_at){await reject(409,'This task changed on another device. Refresh before retrying');return;}
     const now=timestamp(),after=before?structuredClone(before):{...data,id:body.p_task_id,status:'open',created_at:now,created_by_id:actor,created_by:'Synthetic Coordinator',history:[]};
     if(body.p_action==='create'||body.p_action==='update'){Object.assign(after,data);after.assigned_to=data.assigned_to_id===actor?'Synthetic Coordinator':'Synthetic Pastor';after.assignee_available=true;if(data.source_type==='visitor')after.source_label='Synthetic Visitor';}
     else if(body.p_action==='complete')Object.assign(after,{status:'completed',outcome:data.outcome,completed_by_id:actor,completed_by:'Synthetic Coordinator',completed_at:now});
     else if(body.p_action==='start')after.status='in_progress';else if(body.p_action==='cancel')after.status='cancelled';else if(body.p_action==='reopen'){after.status='open';delete after.completed_at;delete after.completed_by;delete after.outcome;}
     after.updated_at=now;after.history.push({action:body.p_action,actor_id:actor,actor_name:'Synthetic Coordinator',at:now,outcome:data.outcome,assigned_to:after.assigned_to,due_date:after.due_date});
     tasks=[after,...tasks.filter(row=>row.id!==after.id)];result=after;receipts.set(body.p_operation_id,{fingerprint,result});
     if(body.p_action==='create'&&interruptCreate){interruptCreate=false;await reject(503,'Synthetic interrupted task confirmation');return;}
    }
   }else if(url.pathname==='/rest/v1/rpc/gwcc_log_visitor_follow_up'){
    const body=request.postDataJSON();logs.push(body);assert.ok(!body.p_data.actor_id&&!body.p_data.minister);const v=fixture.visitors.find(row=>row.id===body.p_visitor_id),now=timestamp();
    interactions.push({id:'task-interaction',visitor_id:v.id,actor_id:actor,actor_name:'Synthetic Coordinator',summary:body.p_data.summary,channel:body.p_data.channel,date:body.p_data.date,created_at:now});
    Object.assign(v,{notes:body.p_data.summary+'\n'+v.notes,follow_up_status:body.p_data.status,updated_at:now});result=v;
   }else if(url.pathname==='/rest/v1/rpc/gwcc_visitor_follow_up_history')result=interactions;
   else if(url.pathname==='/rest/v1/rpc/gwcc_apply_mutations'){
    const body=request.postDataJSON();assert.ok(!body.p_changes.some(change=>change.table==='follow_up_tasks'));result=[];
   }else if(url.pathname.startsWith('/rest/v1/')){
    const rows=fixture[url.pathname.split('/').at(-1)]||[],offset=Number(url.searchParams.get('offset')||0);result=rows.slice(offset,offset+500);if(request.headers().accept?.includes('vnd.pgrst.object'))result=result[0]||null;
   }
   await route.fulfill({status:200,headers,body:JSON.stringify(result)});
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(12000);await page.goto(origin+'/tasks');await page.getByRole('heading',{name:'Follow-up Task Centre',exact:true}).waitFor();await page.getByRole('button',{name:'New task',exact:true}).waitFor();
  return {context,page,actions,logs,errors,fixture,getTasks:()=>tasks,setFailList:value=>{failList=value;},changeVersion:()=>{tasks.find(task=>task.title==='Review supplies').updated_at=timestamp();}};
 }
 const app=await setup();const {page,context,actions,logs,errors}=app;
 try{
  await card(page,'Review supplies').getByText('Overdue · Open',{exact:true}).waitFor();
  await page.getByRole('button',{name:/Needs scheduling/}).click();await page.getByRole('button',{name:'Schedule visitor follow-up',exact:true}).click();
  let dialog=page.getByRole('dialog');await dialog.getByLabel('Responsible staff',{exact:true}).selectOption(colleague);await dialog.getByLabel('Due date',{exact:true}).fill(today);await dialog.getByLabel('Task details',{exact:true}).fill('Call and record the agreed next steps');
  await dialog.getByRole('button',{name:'Save task to cloud',exact:true}).click();await dialog.getByRole('alert').filter({hasText:'Synthetic interrupted task confirmation'}).waitFor();
  await dialog.getByRole('button',{name:'Save task to cloud',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.deepEqual(actions[0],actions[1]);assert.equal(app.getTasks().length,2);
  const follow=card(page,'Follow up with Synthetic Visitor');await follow.getByText('Synthetic Pastor',{exact:true}).waitFor();
  await follow.getByRole('button',{name:'Complete task',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Completion outcome',{exact:true}).fill('Called and agreed a visit next week');await dialog.getByRole('button',{name:'Complete task',exact:true}).click();await dialog.waitFor({state:'hidden'});
  assert.equal(app.fixture.visitors[0].follow_up_status,'new');await page.getByLabel('Task status',{exact:true}).selectOption('all');await follow.getByText('Called and agreed a visit next week',{exact:true}).first().waitFor();
  await follow.getByText(/Task history/).click();await follow.getByText('Called and agreed a visit next week',{exact:true}).last().waitFor();
  await page.getByLabel('Due date',{exact:true}).selectOption('overdue');await card(page,'Review supplies').waitFor();assert.equal(await follow.count(),0);await page.getByLabel('Due date',{exact:true}).selectOption('all');
  await page.getByLabel('Only assigned to me',{exact:true}).check();assert.equal(await follow.count(),0);await page.getByLabel('Only assigned to me',{exact:true}).uncheck();
  await card(page,'Review supplies').getByRole('button',{name:'Edit task',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Task title',{exact:true}).fill('Edited stale title');app.changeVersion();await dialog.getByRole('button',{name:'Save task to cloud',exact:true}).click();await dialog.getByRole('alert').filter({hasText:'changed on another device'}).waitFor();await dialog.getByRole('button',{name:'Close task dialog',exact:true}).click();
  app.setFailList(true);await page.getByRole('button',{name:'Refresh tasks',exact:true}).click();await page.getByRole('alert').filter({hasText:'Synthetic task list unavailable'}).waitFor();assert.equal(await page.getByRole('article').count(),0);assert.equal(await page.getByRole('button',{name:'New task',exact:true}).isDisabled(),true);
  app.setFailList(false);await page.getByRole('button',{name:'Refresh tasks',exact:true}).click();await follow.waitFor();await follow.getByRole('link',{name:'Synthetic Visitor',exact:true}).click();await page.waitForURL('**/visitors?visitor=task-visitor');
  const dossier=()=>page.getByRole('heading',{name:'Synthetic Visitor',exact:true}).locator('xpath=ancestor::div[contains(@class,"fixed")][1]');
  await dossier().getByRole('button',{name:'Pastoral History & Notes',exact:true}).click();await dossier().getByRole('button',{name:'Log Interaction',exact:true}).click();dialog=page.getByRole('dialog');
  assert.equal(await dialog.getByLabel('Recorded by (signed-in account)',{exact:true}).inputValue(),'Synthetic Coordinator');assert.equal(await dialog.getByLabel('Recorded by (signed-in account)',{exact:true}).getAttribute('readonly'),'');
  assert.equal(await dialog.getByLabel('Update Follow-Up Pipeline Status',{exact:true}).getByRole('option',{name:'Converted to Member',exact:true}).count(),0);
  await dialog.getByLabel('Conversation Summary & Pastoral Notes *',{exact:true}).fill('Visitor confirmed a follow-up call <img src=x onerror=alert(1)>');await dialog.getByRole('button',{name:'Save Follow-Up Note',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.equal(logs.length,1);
  await page.goto(origin+'/visitors?visitor=task-visitor');await dossier().getByRole('button',{name:'Pastoral History & Notes',exact:true}).click();await dossier().getByRole('heading',{name:'Verified interaction history',exact:true}).waitFor();assert.equal(await dossier().locator('img[src="x"]').count(),0);
  await page.goto(origin+'/tasks');await card(page,'Review supplies').waitFor();await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>parseFloat(getComputedStyle(document.querySelector('main').parentElement).paddingLeft)===0);
  await page.getByRole('button',{name:'New task',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Task title',{exact:true}).fill('Phone layout task');await dialog.getByLabel('Responsible staff',{exact:true}).selectOption(actor);await dialog.getByLabel('Due date',{exact:true}).fill(today);await dialog.getByRole('button',{name:'Save task to cloud',exact:true}).click();await dialog.waitFor({state:'hidden'});await card(page,'Phone layout task').waitFor();
  const size=await page.evaluate(()=>({view:innerWidth,width:document.documentElement.scrollWidth}));assert.ok(size.width<=size.view+2,JSON.stringify(size));
  if(process.env.TASKS_QA_SCREENSHOT_DIR){for(const button of await page.getByRole('button',{name:'Dismiss toast',exact:true}).all())await button.click();await page.waitForFunction(()=>document.querySelectorAll('button[aria-label="Dismiss toast"]').length===0);await page.screenshot({path:`${process.env.TASKS_QA_SCREENSHOT_DIR}/tasks-mobile.png`,fullPage:true});await page.setViewportSize({width:1440,height:1000});await page.waitForFunction(()=>parseFloat(getComputedStyle(document.querySelector('main').parentElement).paddingLeft)===256);await page.screenshot({path:`${process.env.TASKS_QA_SCREENSHOT_DIR}/tasks-desktop.png`,fullPage:true});}
  assert.deepEqual(errors,[]);
 }catch(cause){console.error('Task browser errors:',errors);console.error(await page.locator('[role=dialog]').innerText().catch(()=>''));if(process.env.TASKS_QA_SCREENSHOT_DIR)await page.screenshot({path:`${process.env.TASKS_QA_SCREENSHOT_DIR}/tasks-failure.png`,fullPage:true});throw cause;}finally{await context.close();}
 const finance=await setup('finance_officer');try{
  await card(finance.page,'Review supplies').waitFor();assert.equal(await finance.page.getByRole('button',{name:/Needs scheduling/}).count(),0);await finance.page.getByRole('button',{name:'New task',exact:true}).click();const dialog=finance.page.getByRole('dialog');
  assert.equal(await dialog.getByLabel('Task category',{exact:true}).getByRole('option').count(),1);assert.equal(await dialog.getByText('Confidential source note',{exact:true}).count(),0);assert.deepEqual(finance.errors,[]);
 }finally{await finance.context.close();}
 console.info('Follow-up browser checks passed: staff ownership, due filters, exact retries after interrupted creation, completion history, stale edit rejection, safe refresh failure, visitor record links, authenticated interaction logging, literal note rendering, mobile/desktop layout and finance role restrictions.');
}
