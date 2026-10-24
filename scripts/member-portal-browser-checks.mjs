import assert from 'node:assert/strict';
import {readSavedOutbox} from './sync-browser-utils.mjs';
import {checkPublicMemberLogin} from './member-access-browser-checks.mjs';

export async function checkMemberPortal(browser,{origin,settings,sampleMember}) {
  const id='66666666-6666-4666-8666-666666666666',exp=Math.floor(Date.now()/1000)+3600;
  const user={id,email:'login@example.test',email_confirmed_at:'2026-10-01T00:00:00Z',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{}};
  const profile={id,email:user.email,first_name:'Portal',last_name:'Member',role:'member',is_active:true,has_login_account:true};
  const token=`${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,role:'authenticated',exp})).toString('base64url')}.test-signature`;
  const session={user,access_token:token,refresh_token:'synthetic-only-refresh',expires_at:exp,expires_in:3600,token_type:'bearer'};
  let own={...sampleMember,id:'portal-own',member_id:'GWCC-PORTAL-OWN',first_name:'Portal',last_name:'Member',auth_user_id:id,phone:'0240000001',email:'contact@example.test',residential_address:'Original address',gps_address:'GA-000-0000',emergency_name:'Original contact',emergency_phone:'0240000002'};
  const future=new Date(Date.now()+14*86400000).toISOString().slice(0,10);
  const event=(id,title,attendees=[])=>({id,title,event_type:'conference',start_date:future,end_date:future,start_time:'18:00',end_time:'20:00',venue:'Synthetic venue',status:'upcoming',requires_registration:true,attendees});
  const events=[event('same-name','Same surname test',[{id:'other',member_id:'someone-else',name:'Another Member',phone:'0240000003',email:'other@example.test'}]),event('target','Registration test'),{...event('draft','Private draft fixture'),status:'draft'},{...event('disabled','No RSVP fixture'),requires_registration:false},{...event('ended','Ended fixture'),start_date:'2000-01-01',end_date:'2000-01-01'}];
  const lastDay=new Date(Date.parse(future+'T12:00:00Z')+2*86400000).toISOString().slice(0,10);
  events.push({...event('multi','Multi-day program'),start_date:new Date(Date.now()-86400000).toISOString().slice(0,10),end_date:lastDay,start_time:'18:00',end_time:'23:30'});
  events.push({...event('cancelled','Cancelled program'),status:'cancelled'});
  let failEventReads=false,readGate=null;
  let includeLegacySurname=true;
  const safeEvent=ev=>({...ev,attendees:ev.id==='same-name'&&includeLegacySurname?[{id:'other',member_id:'someone-else',name:'Another Member'}]:ev.attendees.filter(a=>a.member_id===own.id||a.member_id===own.member_id).map(a=>({id:a.id,member_id:a.member_id,registered_at:a.registered_at,checked_in:a.checked_in}))});
  let attempts=0,rejectNext=true,loseNextResponse=false,legacyCache=false,profileWrites=0,eventReads=0,rawEventReads=0,genericWrites=0;
  const errors=[];
  const newContext=async(width=390,timeZone='Africa/Accra')=>{
    const context=await browser.newContext({viewport:{width,height:1000},timezoneId:timeZone});
    await context.addInitScript(({session,legacyCache})=>{
      localStorage.setItem('gwcc_supabase_url','https://gwcc-e2e.supabase.co');localStorage.setItem('gwcc_supabase_anon_key','test-public-key');localStorage.setItem('gwcc-church-auth-token',JSON.stringify(session));
      if(legacyCache){localStorage.setItem(`gwcc_outbox_v2_${session.user.id}`,JSON.stringify([{id:'88888888-8888-4888-8888-888888888888',changes:[{table:'events',operation:'upsert',id:'same-name',record:{id:'same-name',title:'Same surname test',event_type:'conference',start_date:'2099-12-01',end_date:'2099-12-01',attendees:[{member_id:'portal-own',name:'Portal Member'}]}}],createdAt:'2026-10-17T00:00:00Z',attempts:1,error:'Staff authorization is required'}]));localStorage.setItem(`gwcc_cache_role_${session.user.id}`,'member');localStorage.setItem(`gwcc_cache_${session.user.id}_events`,JSON.stringify([{id:'stale-event',title:'Unsafe cached event',attendees:[{member_id:'other',phone:'0240000003'}]}]));}
    },{session,legacyCache});
    await context.route('https://gwcc-e2e.supabase.co/**',async route=>{
      const req=route.request(),url=new URL(req.url()),headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','content-type':'application/json'};
      if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
      let result=[];
      if(url.pathname==='/auth/v1/user')result=user;
      else if(url.pathname==='/auth/v1/token')result=session;
      else if(url.pathname==='/rest/v1/rpc/gwcc_security_status')result={role:'member',required:false,verified_factors:0,satisfied:true};
      else if(url.pathname==='/rest/v1/rpc/gwcc_member_events'){eventReads++;if(readGate)await readGate;if(failEventReads){await route.fulfill({status:503,headers,json:{message:'Synthetic event list unavailable'}});return;}result=events.map(safeEvent);}
      else if(url.pathname==='/rest/v1/rpc/gwcc_member_records')result=[];
      else if(url.pathname==='/rest/v1/rpc/gwcc_member_action'){
        const body=req.postDataJSON();assert.equal(body.p_action,'profile');assert.equal(body.p_id,own.id);profileWrites++;
        own={...own,...body.p_data,email:own.email};result=own;
      }else if(url.pathname==='/rest/v1/rpc/gwcc_member_rsvp'){
        const body=req.postDataJSON();assert.deepEqual(body,{p_event_id:'target'});attempts++;
        if(rejectNext){rejectNext=false;await route.fulfill({status:503,headers,json:{message:'Connection interrupted; try again.'}});return;}
        if(!events[1].attendees.some(a=>a.member_id===own.id))events[1].attendees.push({id:'saved-registration',member_id:own.id,name:'Portal Member',registered_at:new Date().toISOString(),checked_in:false});
        if(loseNextResponse){loseNextResponse=false;await route.fulfill({status:503,headers,json:{message:'Confirmation interrupted; retry to check your registration.'}});return;}
        result=safeEvent(events[1]);
      }else if(url.pathname==='/rest/v1/rpc/gwcc_apply_mutations'){genericWrites++;await route.fulfill({status:403,headers,json:{message:'Staff authorization is required'}});return;}
      else if(url.pathname.startsWith('/rest/v1/')){
        const table=url.pathname.split('/').at(-1);
        if(table==='events')rawEventReads++;
        const rows=table==='profiles'?[profile]:table==='members'?[own]:table==='settings'?[{id:'gwcc_global_settings',...settings}]:[];
        const range=req.headers().range?.split('-').map(Number),offset=Number(url.searchParams.get('offset')||range?.[0]||0),limit=Number(url.searchParams.get('limit')||500);
        if(table==='members'&&req.headers().accept?.includes('vnd.pgrst.object'))await new Promise(resolve=>setTimeout(resolve,100));
        result=req.headers().accept?.includes('vnd.pgrst.object')?rows[0]||null:rows.slice(offset,offset+limit);
      }
      await route.fulfill({status:200,headers,body:JSON.stringify(result)});
    });
    return context;
  };
  const unsigned=await browser.newContext({viewport:{width:390,height:844}});
  await unsigned.addInitScript(()=>{localStorage.setItem('gwcc_supabase_url','https://gwcc-e2e.supabase.co');localStorage.setItem('gwcc_supabase_anon_key','test-public-key');});
  await checkPublicMemberLogin(await unsigned.newPage(),unsigned,{origin});await unsigned.close();
  let context=await newContext();let page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(`${origin}/portal?tab=profile`);
    await page.getByLabel('Phone Number (WhatsApp)',{exact:true}).waitFor();
    await page.waitForFunction(()=>document.querySelector('#portal-profile-0')?.value==='0240000001');
    assert.equal(await page.getByLabel('Email Address',{exact:true}).inputValue(),'contact@example.test');
    assert.equal(await page.getByLabel('Email Address',{exact:true}).getAttribute('readonly'),'');
    assert.equal(await page.getByLabel('Residential Address',{exact:true}).inputValue(),'Original address');
    assert.equal(await page.getByLabel('Emergency Contact Name',{exact:true}).inputValue(),'Original contact');
    await page.getByLabel('Phone Number (WhatsApp)',{exact:true}).fill('0240000004');
    await page.getByLabel('Residential Address',{exact:true}).fill('');
    await page.getByRole('button',{name:'Save Profile Changes',exact:true}).click();
    await page.getByText('Profile Updated',{exact:true}).waitFor();
    assert.equal(profileWrites,1);assert.equal(own.phone,'0240000004');assert.equal(own.residential_address,'');
    assert.equal(await page.getByText('Email Update Required',{exact:true}).count(),0);
    await page.reload();await page.waitForFunction(()=>document.querySelector('#portal-profile-0')?.value==='0240000004');
    await page.goto(`${origin}/portal?tab=events`);await page.getByText('Registration test',{exact:true}).waitFor();
    const card=()=>page.getByRole('article',{name:'Registration test',exact:true});
    assert.equal(await page.getByText('Private draft fixture',{exact:true}).count(),0);
    assert.equal(await page.getByRole('button',{name:'RSVP not enabled',exact:true}).isDisabled(),true);
    assert.equal(await page.getByText('Ended fixture',{exact:true}).count(),0);
    assert.equal(await page.getByText('Cancelled program',{exact:true}).count(),0);
    const multi=page.getByRole('article',{name:'Multi-day program',exact:true});
    await multi.getByText('Ongoing',{exact:true}).waitFor();
    const lastDate=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Accra',day:'2-digit',month:'short',year:'numeric'}).format(new Date(lastDay+'T00:00:00Z'));
    assert.ok((await multi.innerText()).includes(lastDate));assert.ok((await multi.innerText()).includes('23:30'));
    await page.getByRole('button',{name:/^Past & cancelled/}).click();
    await page.getByRole('article',{name:'Cancelled program',exact:true}).getByText('Cancelled',{exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Registration closed',exact:true}).isDisabled(),true);
    await page.getByRole('button',{name:/^Upcoming & ongoing/}).click();
    // An older response with a same-surname attendee must not establish this member's identity.
    assert.equal(await page.getByText('RSVP Confirmed (See You There!)',{exact:true}).count(),0);
    await card().getByRole('button',{name:'1-Click RSVP for Event',exact:true}).evaluate(button=>{button.click();button.click();});
    await card().getByRole('alert').filter({hasText:'Registration could not be confirmed'}).waitFor();
    assert.equal(await card().getByText('RSVP Confirmed (See You There!)',{exact:true}).count(),0);
    assert.equal(events[1].attendees.length,0);
    loseNextResponse=true;
    await card().getByRole('button',{name:'1-Click RSVP for Event',exact:true}).click();
    await card().getByRole('alert').filter({hasText:'Registration could not be confirmed'}).waitFor();
    assert.equal(events[1].attendees.length,1);
    assert.equal(await card().getByText('RSVP Confirmed (See You There!)',{exact:true}).count(),0);
    await card().getByRole('button',{name:'1-Click RSVP for Event',exact:true}).click();
    await card().getByText('RSVP Confirmed (See You There!)',{exact:true}).waitFor();
    assert.equal(attempts,3);assert.equal(events[1].attendees.length,1);
    await page.reload();await card().getByText('RSVP Confirmed (See You There!)',{exact:true}).waitFor();
    assert.equal(rawEventReads,0);assert.ok(eventReads>0);assert.equal(genericWrites,0);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Mobile portal overflows');
    await context.close();legacyCache=true;includeLegacySurname=false;context=await newContext(1440);page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${origin}/portal?tab=events`);await card().getByText('RSVP Confirmed (See You There!)',{exact:true}).waitFor();
    assert.equal(await page.getByText('Unsafe cached event',{exact:true}).count(),0);
    assert.equal(await page.getByText('other@example.test',{exact:true}).count(),0);
    assert.equal(events[1].attendees.length,1);
    const sameCard=page.getByRole('article',{name:'Same surname test',exact:true});
    assert.equal(await sameCard.getByText('RSVP Confirmed (See You There!)',{exact:true}).count(),0);
    const held=await readSavedOutbox(page,id);assert.equal(held.batches[0].id,'88888888-8888-4888-8888-888888888888');assert.equal(held.batches[0].changes[0].id,'same-name');assert.equal(genericWrites,0);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Desktop portal overflows');
    const panel=()=>page.getByRole('region',{name:'Church Events',exact:true});
    const savedRegistration=structuredClone(events[1].attendees);
    events[1].attendees=[];
    await panel().getByRole('button',{name:'Refresh events',exact:true}).click();
    await card().getByRole('button',{name:'1-Click RSVP for Event',exact:true}).waitFor();
    assert.equal(await card().getByText('RSVP Confirmed (See You There!)',{exact:true}).count(),0,'Authoritative refresh removes stale confirmation');
    events[1].description='Synthetic coordinator update';
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await card().getByText('Synthetic coordinator update',{exact:true}).waitFor();
    events[1].attendees=savedRegistration;
    await panel().getByRole('button',{name:'Refresh events',exact:true}).click();
    await card().getByText('RSVP Confirmed (See You There!)',{exact:true}).waitFor();
    failEventReads=true;
    await panel().getByRole('button',{name:'Refresh events',exact:true}).click();
    await panel().getByRole('alert').filter({hasText:'Events could not be refreshed'}).waitFor();
    await card().getByText('Registration previously recorded — refresh to confirm its current status',{exact:true}).waitFor();
    failEventReads=false;
    await panel().getByRole('button',{name:'Retry loading events',exact:true}).click();
    await card().getByText('RSVP Confirmed (See You There!)',{exact:true}).waitFor();
    events[1].status='cancelled';
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await card().waitFor({state:'hidden'});
    await panel().getByRole('button',{name:/^Past & cancelled/}).click();
    await card().getByText('Event cancelled — registration kept for reference',{exact:true}).waitFor();
    assert.equal(await card().getByText('RSVP Confirmed (See You There!)',{exact:true}).count(),0);
    await panel().getByRole('button',{name:/^Upcoming & ongoing/}).click();
    await context.setOffline(true);
    await panel().getByRole('alert').filter({hasText:'You’re offline'}).waitFor();
    events[1].status='upcoming';events[1].description='Synthetic reconnected update';
    await context.setOffline(false);
    await card().getByText('Synthetic reconnected update',{exact:true}).waitFor();
    if(process.env.TEST_MEMBER_EVENTS_DESKTOP)await page.screenshot({path:process.env.TEST_MEMBER_EVENTS_DESKTOP,fullPage:true});
    await context.close();legacyCache=false;
    let releaseReads;
    readGate=new Promise(resolve=>{releaseReads=resolve;});
    context=await newContext(390,'Pacific/Auckland');page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/portal?tab=events');await panel().getByText('Loading events…',{exact:true}).waitFor();
    assert.equal(await panel().getByText(/No upcoming/).count(),0,'Loading is not reported as an empty event list');
    releaseReads();readGate=null;
    await card().getByText('RSVP Confirmed (See You There!)',{exact:true}).waitFor();
    assert.ok((await page.getByRole('article',{name:'Multi-day program',exact:true}).innerText()).includes(lastDate),'Schedules remain in Ghana dates for overseas viewers');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Updated member events overflow on mobile');
    if(process.env.TEST_MEMBER_EVENTS_MOBILE)await page.screenshot({path:process.env.TEST_MEMBER_EVENTS_MOBILE,fullPage:true});
    await context.close();events.splice(0,events.length);
    context=await newContext();page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/portal?tab=events');await panel().getByText('No upcoming or ongoing events are published right now.',{exact:true}).waitFor();
    await panel().getByRole('button',{name:/^Past & cancelled/}).click();await panel().getByText('No past or cancelled events are published.',{exact:true}).waitFor();
    await context.close();failEventReads=true;
    context=await newContext();page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/portal?tab=events');await panel().getByRole('alert').filter({hasText:'Events could not be refreshed'}).waitFor();
    assert.equal(await panel().getByText('No upcoming or ongoing events are published right now.',{exact:true}).count(),0,'Failed loads do not look like a confirmed empty calendar');
    failEventReads=false;await panel().getByRole('button',{name:'Retry loading events',exact:true}).click();
    await panel().getByText('No upcoming or ongoing events are published right now.',{exact:true}).waitFor();
    assert.equal(rawEventReads,0);assert.equal(genericWrites,0);assert.equal(attempts,3);
    assert.deepEqual(errors,[]);
    console.info('Member portal browser checks passed: profile hydration and saving, separate contact/login email, cleared fields, exact RSVP identity, failed and lost-response retries, cross-device saved registration, member event projection, no staff writes, old cache exclusion, authoritative registration removal, separate event history, full Ghana schedules, focus/reconnect refresh, loading/empty/error states, safe retries and mobile/desktop layout.');
  }finally{await context.close();}
}
