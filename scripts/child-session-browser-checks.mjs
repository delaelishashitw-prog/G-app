import assert from 'node:assert/strict';
import {watchSyncStatus,waitForSync} from './sync-browser-utils.mjs';
import {attendanceFixtures} from './attendance-browser-checks.mjs';

// Isolated synthetic families. This never contacts a live church database.
export async function checkChildSession(browser,{origin,settings,sampleMember}) {
  for(const width of [390,1440]) {
    const now=new Date(),stamp=now.toISOString(),today=stamp.slice(0,10),previous=new Date(now.getTime()-86400000).toISOString().slice(0,10);
    const id='48484848-4848-4484-8484-484848484848',role='attendance_officer';
    const profile={id,role,email:'child-session@example.test',first_name:'Synthetic',last_name:'Usher',is_active:true,has_login_account:true,authorization_reviewed_at:stamp};
    const user={id,email:profile.email,email_confirmed_at:stamp,aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{}};
    const exp=Math.floor(Date.now()/1000)+3600,access_token=`${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,role:'authenticated',exp})).toString('base64url')}.synthetic-signature`;
    const session={user,access_token,refresh_token:'synthetic-child-session',expires_at:exp,expires_in:3600,token_type:'bearer'};
    const data={...attendanceFixtures(now,[sampleMember]).tables,settings:[{id:'gwcc_global_settings',...settings}],profiles:[profile]};
    const child=(id,name,serviceId,date,code)=>({id,child_name:name,service_id:serviceId,service_name:data.services.find(s=>s.id===serviceId).name,date,security_code:code,age_group:'juniors',class_room:'Synthetic classroom',parent_name:'Synthetic Parent',parent_phone:'0240000001',check_in_time:'08:00',status:'checked_in',has_allergy_alert:false,created_at:stamp});
    data.child_check_ins=[child('other-service-child','Other Service Child','qa-att-service',previous,'GWCC-AAAAAAAAAAAA'),child('other-date-child','Other Date Child','qa-att-other',today,'GWCC-BBBBBBBBBBBB')];
    const context=await browser.newContext({viewport:{width,height:1000},timezoneId:'Pacific/Auckland',reducedMotion:'reduce'}),requests=[],errors=[],receipts=new Map();let loseCheckInReply=true;
    await context.addInitScript(watchSyncStatus);
    await context.addInitScript(({session})=>{localStorage.setItem('gwcc_supabase_url','https://gwcc-e2e.supabase.co');localStorage.setItem('gwcc_supabase_anon_key','synthetic-public-key');localStorage.setItem('gwcc-church-auth-token',JSON.stringify(session));},{session});
    await context.route('https://gwcc-e2e.supabase.co/**',async route=>{
      const request=route.request(),url=new URL(request.url()),headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','content-type':'application/json'};
      if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
      let result=[];
      if(url.pathname==='/auth/v1/user')result=user;
      else if(url.pathname==='/auth/v1/token')result=session;
      else if(url.pathname==='/rest/v1/profiles')result=request.headers().accept?.includes('vnd.pgrst.object')?profile:[profile];
      else if(url.pathname==='/rest/v1/rpc/gwcc_security_status')result={role,required:false,verified_factors:0,satisfied:true};
      else if(url.pathname==='/rest/v1/rpc/gwcc_apply_mutations'){
        const body=request.postDataJSON();requests.push(body);
        if(receipts.has(body.p_operation_id))result=receipts.get(body.p_operation_id);
        else{
          result=body.p_changes.filter(c=>c.table!=='audit_logs').map(c=>{
            assert.equal(c.table,'child_check_ins');assert.equal(c.operation,'upsert');
            const record={...c.record,updated_at:new Date().toISOString()};data.child_check_ins=[record,...data.child_check_ins.filter(r=>r.id!==c.id)];return {table:c.table,record};
          });receipts.set(body.p_operation_id,result);
        }
        if(loseCheckInReply){loseCheckInReply=false;await new Promise(resolve=>setTimeout(resolve,250));await route.fulfill({status:503,headers,json:{message:'Synthetic lost child check-in reply'}});return;}
      }else if(url.pathname.startsWith('/rest/v1/')){const rows=data[url.pathname.split('/').at(-1)]||[];result=rows.slice(Number(url.searchParams.get('offset')||0),Number(url.searchParams.get('offset')||0)+Number(url.searchParams.get('limit')||500));}
      await route.fulfill({status:200,headers,json:result});
    });
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    const dialog=()=>page.getByRole('dialog',{name:'Child safety and pickup',exact:true});
    const waitMutation=()=>page.waitForResponse(r=>r.url().endsWith('/rpc/gwcc_apply_mutations')&&r.request().postDataJSON()?.p_changes?.some(c=>c.table==='child_check_ins'));
    const close=()=>dialog().getByRole('button',{name:'Close child safety',exact:true}).click();
    const open=()=>page.getByRole('button',{name:'Child Safety Tags',exact:true}).click();
    const fill=async name=>{await dialog().getByLabel('Child full name',{exact:true}).fill(name);await dialog().getByLabel('Parent or guardian name',{exact:true}).fill('Synthetic Parent');await dialog().getByLabel('Parent phone contact',{exact:true}).fill('0240000001');};
    try {
      await page.goto(`${origin}/attendance?serviceId=qa-att-other&date=${previous}`);
      await open();await dialog().getByLabel('Child safety session').getByText('QA Other Attendance Service',{exact:true}).waitFor();
      await dialog().getByLabel('Child safety session').getByText(new RegExp(previous)).waitFor();
      assert.equal(await dialog().getByRole('button',{name:'Wearable Tag & Parent Stub',exact:true}).isDisabled(),true);
      await fill('Selected Session Child');await Promise.all([waitMutation(),dialog().getByRole('button',{name:'Generate Security Passes',exact:true}).click()]);
      await page.getByText('Synthetic lost child check-in reply',{exact:true}).first().waitFor();
      assert.equal(await dialog().getByLabel('Child full name',{exact:true}).inputValue(),'Selected Session Child');
      await dialog().getByRole('button',{name:'Generate Security Passes',exact:true}).click();
      await dialog().getByText('Parent Official Pickup Pass',{exact:true}).waitFor();await waitForSync(page);
      assert.equal(data.child_check_ins.filter(r=>r.child_name==='Selected Session Child').length,1,'Retry must not create another active check-in or pickup tag.');
      assert.deepEqual(requests[1],requests[0],'The lost reply retries the same operation and payload.');
      const saved=data.child_check_ins.find(r=>r.child_name==='Selected Session Child');assert.ok(saved);assert.equal(saved.service_id,'qa-att-other');assert.equal(saved.date,previous);
      const validTimes=[-60000,0,60000].map(delta=>new Date(Date.parse(saved.created_at)+delta).toISOString().slice(11,16));assert.ok(validTimes.includes(saved.check_in_time),'Check-in time must use Ghana time, regardless of the staff device timezone.');
      assert.equal(await dialog().locator('.print-container').getByText(`QA Other Attendance Service · ${previous} (GMT)`,{exact:true}).count(),2,'Both printable passes identify the actual session.');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Child safety mobile overflow');
      await close();await page.getByRole('button',{name:/Children & Security Passes/}).click();
      await page.getByRole('row').filter({has:page.getByText('Selected Session Child',{exact:true})}).waitFor();
      assert.equal(await page.getByText('Other Date Child',{exact:true}).count(),0);assert.equal(await page.getByText('Other Service Child',{exact:true}).count(),0);
      await page.getByLabel('Attendance date (GMT)',{exact:true}).fill(today);
      await page.getByRole('row').filter({has:page.getByText('Other Date Child',{exact:true})}).waitFor();
      assert.equal(await page.getByText('Selected Session Child',{exact:true}).count(),0);
      await open();assert.equal(await dialog().getByLabel('Child full name',{exact:true}).inputValue(),'');assert.equal(await dialog().getByRole('button',{name:'Wearable Tag & Parent Stub',exact:true}).isDisabled(),true);await close();
      await page.getByLabel('Attendance date (GMT)',{exact:true}).fill(previous);
      await page.getByRole('button',{name:'Verify Pickup Stub',exact:true}).click();
      await dialog().getByLabel('Pickup security code',{exact:true}).fill('GWCC-AAAAAAAAAAAA');await dialog().getByLabel('Pickup collector name',{exact:true}).fill('Synthetic Parent');
      const before=requests.length;await dialog().locator('form').getByRole('button',{name:'Verify & Release Child',exact:true}).click();await page.getByText('No active check-in matches this tag.',{exact:true}).waitFor();assert.equal(requests.length,before);
      await dialog().getByLabel('Pickup security code',{exact:true}).fill(saved.security_code);await Promise.all([waitMutation(),dialog().locator('form').getByRole('button',{name:'Verify & Release Child',exact:true}).click()]);await waitForSync(page);
      assert.equal(data.child_check_ins.find(r=>r.id===saved.id).status,'checked_out');assert.equal(data.child_check_ins.find(r=>r.id===saved.id).check_out_time,new Date().toISOString().slice(11,16));assert.equal(data.child_check_ins.find(r=>r.id==='other-service-child').status,'checked_in');await close();
      await page.getByLabel('Attendance service',{exact:true}).selectOption('qa-archived-service');assert.equal(await page.getByRole('button',{name:'Child Safety Tags',exact:true}).isDisabled(),true);assert.equal(await page.getByRole('button',{name:'+ Check In Child',exact:true}).isDisabled(),true);
      await page.getByRole('button',{name:'Verify Pickup Stub',exact:true}).click();assert.equal(await dialog().getByRole('button',{name:'Check-in Child',exact:true}).isDisabled(),true);await close();
      await page.getByLabel('Attendance service',{exact:true}).selectOption('qa-att-other');await page.getByLabel('Attendance date (GMT)',{exact:true}).fill('2999-01-01');assert.equal(await page.getByRole('button',{name:'Child Safety Tags',exact:true}).isDisabled(),true);
      await page.goto(`${origin}/attendance?serviceId=missing-child-service&date=${previous}`);await page.getByText('Select an existing service.',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Child Safety Tags',exact:true}).isDisabled(),true);
      assert.equal(receipts.size,2,'Only the requested session check-in and its authorized pickup should write records.');assert.equal(errors.length,0,errors.join(' | '));
    }catch(error){console.log('Child session failure:',(await page.locator('body').innerText()).slice(-5000));await page.screenshot({path:'/tmp/gwcc-child-session-failure.png',fullPage:true});throw error;}finally{await context.close();}
  }
  console.log('Child session browser checks passed: lost reply without duplicate tags, second service, historical date, Ghana check-in and checkout time on overseas devices, correct roster and printed passes, fresh forms, session-scoped pickup, archived/future/missing service guards, and mobile/desktop layout.');
}
