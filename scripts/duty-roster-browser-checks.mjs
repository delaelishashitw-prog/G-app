import assert from 'node:assert/strict';
export async function checkDutyRoster(browser,{origin,settings,sampleMember}){
 const id='77777777-7777-4777-8777-777777777777',exp=Math.floor(Date.now()/1000)+3600;
 const user={id,email:'roster@example.test',email_confirmed_at:'2026-10-01T00:00:00Z',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{}};
 const profile={id,email:user.email,first_name:'Roster',last_name:'Member',role:'member',is_active:true,has_login_account:true,authorization_reviewed_at:'2026-10-01T00:00:00Z'};
 const token=`${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,role:'authenticated',exp})).toString('base64url')}.test-signature`;
 const session={user,access_token:token,refresh_token:'synthetic-roster-refresh',expires_at:exp,expires_in:3600,token_type:'bearer'};
 const own={...sampleMember,id:'roster-own',member_id:'GWCC-ROSTER-OWN',first_name:'Roster',last_name:'Member',auth_user_id:id,is_archived:false,status:'active'};
 const replacement={...own,id:'roster-replacement',member_id:'GWCC-REPLACEMENT',first_name:'Replacement',last_name:'Volunteer',auth_user_id:null};
 const date=new Date(Date.now()+7*86400000).toISOString().slice(0,10),stamp='2026-10-17T00:00:00Z';
 const service={id:'roster-service',name:'FutureSyntheticService',type:'sunday',day_of_week:'Sunday',start_time:'08:00',end_time:'10:30',is_active:true};
 const row=(id,date,name,memberId=own.id)=>({id,member_id:memberId,member_name:'Roster Member',service_id:service.id,service_name:name,date,department:'ushers_protocol',role_title:'Usher',report_time:'07:30',status:'pending',notes:'Original coordinator instructions',created_at:stamp,updated_at:stamp});
 const assignments=[row('future-duty',date,service.name),row('past-duty','2020-01-01','PastSyntheticService'),{...row('unlinked','2020-01-02','Unlinked historical service','ext-old'),member_name:'Legacy Misspelled Name'}];
 const requests=[],submits=[],reviews=[],links=[],errors=[];let rejectFirst=true,loseNext=false,pastOnly=false;
 const createContext=async(width)=>{
  const context=await browser.newContext({viewport:{width,height:1000}});
  await context.addInitScript(({session})=>{localStorage.setItem('gwcc_supabase_url','https://gwcc-e2e.supabase.co');localStorage.setItem('gwcc_supabase_anon_key','test-public-key');localStorage.setItem('gwcc-church-auth-token',JSON.stringify(session));},{session});
  await context.route('https://gwcc-e2e.supabase.co/**',async route=>{
   const req=route.request(),url=new URL(req.url()),headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','content-type':'application/json'};
   if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
   let result=[];
   if(url.pathname==='/auth/v1/user')result=user;else if(url.pathname==='/auth/v1/token')result=session;
   else if(url.pathname==='/rest/v1/rpc/gwcc_security_status')result={role:profile.role,required:profile.role!=='member',verified_factors:profile.role==='member'?0:1,satisfied:true};
   else if(url.pathname==='/rest/v1/rpc/gwcc_roster_requests')result=requests;
   else if(url.pathname==='/rest/v1/rpc/gwcc_member_events'||url.pathname==='/rest/v1/rpc/gwcc_member_records')result=[];
   else if(url.pathname==='/rest/v1/rpc/gwcc_member_action'){
    const b=req.postDataJSON();assert.equal(b.p_action,'roster');assert.equal(b.p_id,'future-duty');assert.equal(b.p_data.expected_updated_at,assignments[0].updated_at);
    if(b.p_data.status==='confirmed'){assignments[0].status='confirmed';assignments[0].updated_at='2026-10-17T00:00:01Z';result=assignments[0];}
    else{
     assert.equal(b.p_data.status,'substitute_requested');submits.push(b);
     if(rejectFirst){rejectFirst=false;await route.fulfill({status:503,headers,json:{message:'Network failed. Your request was not saved.'}});return;}
     if(!requests.length)requests.push({id:b.p_id,assignment_id:b.p_id,member_id:own.id,member_name:'Roster Member',service_id:service.id,service_name:service.name,date,role_title:'Usher',status:'pending',...b.p_data,created_at:stamp,updated_at:stamp});
     // The database owns the request status, independent of the submitted action.
     requests[0].status='pending';
     if(loseNext){loseNext=false;await route.fulfill({status:503,headers,json:{message:'Confirmation interrupted. Retry this same request.'}});return;}
     result=requests[0];
    }
   }else if(url.pathname==='/rest/v1/rpc/gwcc_review_roster_request'){
    const b=req.postDataJSON();reviews.push(b);assert.equal(b.p_action,'approve');assert.equal(b.p_replacement_id,replacement.id);assert.equal(b.p_version,requests[0].updated_at);assert.equal(b.p_assignment_version,assignments[0].updated_at);
    requests[0]={...requests[0],status:'approved',replacement_member_name:'Replacement Volunteer',replacement_member_id:replacement.id,updated_at:'2026-10-17T00:00:02Z'};
    assignments[0].status='substituted';assignments.push({...assignments[0],id:'new-replacement-duty',member_id:replacement.id,member_name:'Replacement Volunteer',status:'pending'});result=requests[0];
   }else if(url.pathname==='/rest/v1/rpc/gwcc_link_historical_roster'){
    const b=req.postDataJSON();links.push(b);assert.equal(b.p_id,'unlinked');assert.equal(b.p_member_id,own.id);assignments[2].member_id=own.id;result=assignments[2];
   }else if(url.pathname==='/rest/v1/rpc/gwcc_apply_mutations')throw new Error('Roster actions must not enter the offline staff outbox.');
   else if(url.pathname.startsWith('/rest/v1/')){
    const table=url.pathname.split('/').at(-1);let rows=table==='profiles'?[profile]:table==='members'?profile.role==='member'?[own]:[own,replacement]:table==='services'?[service]:table==='settings'?[{id:'gwcc_global_settings',...settings}]:table==='roster_assignments'?assignments.filter(a=>(profile.role!=='member'||a.member_id===own.id)&&(!pastOnly||a.id==='past-duty')):[];
    const range=req.headers().range?.split('-').map(Number),offset=Number(url.searchParams.get('offset')||range?.[0]||0),limit=Number(url.searchParams.get('limit')||500);
    result=req.headers().accept?.includes('vnd.pgrst.object')?rows[0]||null:rows.slice(offset,offset+limit);
   }
   await route.fulfill({status:200,headers,body:JSON.stringify(result)});
  });return context;
 };
 let context=await createContext(390),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(`${origin}/portal?tab=roster`);await page.getByRole('button',{name:'Upcoming Shifts (1)',exact:true}).waitFor();
  assert.equal(await page.getByText('PastSyntheticService',{exact:true}).count(),0);
  await page.getByRole('button',{name:'Past History (1)',exact:true}).click();await page.getByText('Historical duty — read-only',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Confirm Attendance',exact:true}).last().isEnabled(),false);
  assert.equal(await page.getByRole('button',{name:'Request Substitute',exact:true}).last().isEnabled(),false);
  await page.getByRole('button',{name:'Upcoming Shifts (1)',exact:true}).click();
  await page.getByRole('button',{name:'Confirm Attendance',exact:true}).last().click();await page.getByText('Duty Confirmed',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Request Substitute',exact:true}).last().click();
  const dialog=page.getByRole('dialog',{name:'Request Service Substitute',exact:true});await dialog.getByLabel('Additional Notes for Department Head',{exact:true}).fill('Synthetic request note');
  await dialog.getByLabel('Suggested Replacement Volunteer (Optional)',{exact:true}).fill('Ask another volunteer');
  await dialog.getByRole('button',{name:'Submit Request',exact:true}).click();await dialog.getByRole('alert').filter({hasText:'Network failed'}).waitFor();
  assert.equal(await dialog.getByLabel('Additional Notes for Department Head',{exact:true}).inputValue(),'Synthetic request note');
  loseNext=true;await dialog.getByRole('button',{name:'Submit Request',exact:true}).click();await dialog.getByRole('alert').filter({hasText:'Confirmation interrupted'}).waitFor();
  await dialog.getByRole('button',{name:'Submit Request',exact:true}).click();await dialog.waitFor({state:'detached'});
  await page.getByText('Substitute requested — awaiting coordinator review',{exact:true}).waitFor();
  assert.equal(requests.length,1);assert.equal(submits.length,3);assert.equal(new Set(submits.map(b=>b.p_data.request_id)).size,1);assert.equal(submits[0].p_data.notes,'Synthetic request note');
  assert.equal(assignments[0].status,'confirmed');assert.equal(assignments[0].notes,'Original coordinator instructions');
  await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth+2,null,{timeout:3000}).catch(()=>{});const overflow=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth,elements:[...document.querySelectorAll('body *')].filter(e=>!e.closest('nav')&&e.getBoundingClientRect().right>innerWidth+2).slice(0,15).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent?.slice(0,80),right:e.getBoundingClientRect().right}))}));assert.ok(overflow.width<=overflow.viewport+2,`Mobile duty roster overflows: ${JSON.stringify(overflow)}`);
  await context.close();profile.role='super_admin';context=await createContext(1440);page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${origin}/services?tab=roster`);
  const panel=page.getByRole('region',{name:'Roster substitute requests',exact:true});
  const request=panel.getByRole('article',{name:'Substitute request for Roster Member',exact:true});await request.waitFor();
  assert.equal(await request.getByRole('button',{name:'Approve replacement',exact:true}).isEnabled(),false);
  await request.getByLabel('Replacement member for Roster Member',{exact:true}).selectOption(replacement.id);
  await request.getByRole('button',{name:'Approve replacement',exact:true}).click();await panel.getByRole('status').filter({hasText:'Replacement assigned'}).waitFor();
  assert.equal(reviews.length,1);assert.equal(assignments[0].status,'substituted');assert.equal(assignments.at(-1).status,'pending');assert.equal(assignments.at(-1).notes,'Original coordinator instructions');
  const link=panel.getByLabel('Reviewed member for historical assignment Legacy Misspelled Name',{exact:true});await link.waitFor();
  assert.equal(await panel.getByRole('button',{name:'Confirm historical member link',exact:true}).isEnabled(),false);
  await link.selectOption(own.id);await panel.getByRole('button',{name:'Confirm historical member link',exact:true}).click();await panel.getByRole('status').filter({hasText:'Historical link saved'}).waitFor();assert.equal(links.length,1);assert.equal(assignments[2].date,'2020-01-02');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Coordinator panel overflows');
  await context.close();profile.role='member';pastOnly=true;context=await createContext(390);page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${origin}/portal?tab=roster`);await page.getByRole('button',{name:'Upcoming Shifts (0)',exact:true}).waitFor();
  assert.equal(await page.getByText('PastSyntheticService',{exact:true}).count(),0);assert.equal(await page.getByText('Next Upcoming Duty',{exact:false}).count(),0);
  await page.getByRole('button',{name:'Download My Duty',exact:true}).first().click();
  await page.getByRole('heading',{name:'Download My Duty Roster',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Download My Duty (PDF)',exact:true}).isEnabled(),false);
  assert.deepEqual(errors,[]);
  console.info('Duty roster browser checks passed: Ghana date filters, historical read-only controls, confirmation, failed/lost-response request retry with preserved fields, pending coordinator review, preserved instructions, replacement approval, explicit historical linking, zero-upcoming PDF controls, and mobile/desktop layout.');
 }finally{await context.close();}
}
