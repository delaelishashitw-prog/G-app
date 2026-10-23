import assert from 'node:assert/strict';

export async function checkAiAgent(browser,{origin,settings,sampleMember}) {
  const today=new Date().toISOString().slice(0,10),start=new Date(Date.now()-6*86400000).toISOString().slice(0,10);
  const actor='78787878-7878-4878-8878-787878787878';
  for(const [width,role] of [[390,'pastor'],[1440,'super_admin'],[390,'attendance_officer'],[1440,'finance_officer']]) {
    const profile={id:actor,email:'synthetic-ai@example.test',first_name:'Synthetic',last_name:'AI Tester',role,is_active:true,has_login_account:true,authorization_reviewed_at:today};
    const user={id:actor,email:profile.email,email_confirmed_at:today,role:'authenticated',aud:'authenticated',app_metadata:{provider:'email'},user_metadata:{}};
    const exp=Math.floor(Date.now()/1000)+3600,token=`${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:actor,role:'authenticated',exp,aal:'aal2',session_id:actor})).toString('base64url')}.test-signature`;
    const session={user,access_token:token,refresh_token:'synthetic-ai-refresh',expires_in:3600,expires_at:exp,token_type:'bearer'};
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
    await context.addInitScript(({session})=>{
      localStorage.setItem('gwcc_supabase_url','https://gwcc-e2e.supabase.co');localStorage.setItem('gwcc_supabase_anon_key','synthetic-public-key');localStorage.setItem('gwcc-church-auth-token',JSON.stringify(session));
    },{session});
    const fixture={profiles:[profile],settings:[{id:'gwcc_global_settings',...settings}],members:[{...sampleMember,id:'synthetic-private-person',first_name:'Never send this name',phone:'0240000000',is_archived:false}]};
    const requests=[],errors=[];let failSummary=false,failReport=false,empty=false,releaseSummary;
    let holdSummary=false;
    await context.route('https://gwcc-e2e.supabase.co/**',async route=>{
      const req=route.request(),url=new URL(req.url()),headers={'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'*'};
      if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
      let result=[];
      if(url.pathname==='/auth/v1/user')result=user;
      else if(url.pathname==='/auth/v1/token')result=session;
      else if(url.pathname==='/rest/v1/rpc/gwcc_security_status')result={role,required:true,verified_factors:1,satisfied:true};
      else if(url.pathname==='/rest/v1/rpc/gwcc_release_status')result={migration:'20261015000001',role};
      else if(['/rest/v1/rpc/gwcc_follow_up_list','/rest/v1/rpc/gwcc_giving_channels'].includes(url.pathname))result=[];
      else if(url.pathname.startsWith('/rest/v1/')) {
        assert.equal(req.method(),'GET',`AI must not modify church records: ${url.pathname}`);
        const rows=fixture[url.pathname.split('/').at(-1)]||[];result=req.headers().accept?.includes('vnd.pgrst.object')?rows[0]||null:rows;
      }
      await route.fulfill({status:200,headers,body:JSON.stringify(result)});
    });
    const summary=period=>({period,totalCheckins:empty?0:3,memberCheckins:empty?0:2,visitorCheckins:empty?0:1,sourceRecords:empty?0:4,excludedRecords:empty?0:1,byService:empty?[]:[{serviceId:'synthetic-service',serviceName:'Synthetic service',checkins:3}],byDay:[],metric:'Recorded present check-ins, not total auditorium attendance.',generatedAt:new Date().toISOString()});
    await context.route(origin+'/api/**',async route=>{
      const req=route.request(),path=new URL(req.url()).pathname,body=req.postDataJSON();requests.push({path,body});
      assert.equal(req.headers().authorization,`Bearer ${token}`);
      if(path==='/api/ai/assistant') {
        assert.deepEqual(Object.keys(body),['prompt']);assert.equal(JSON.stringify(body).includes('Never send this name'),false);
        await route.fulfill({json:{text:'Synthetic sermon draft',model:'synthetic-model',status:'draft'}});return;
      }
      assert.ok(['/api/ai/attendance-insights','/api/ai/attendance-report'].includes(path),'Unapproved action');
      assert.deepEqual(Object.keys(body).sort(),['endDate','startDate']);
      if(path.endsWith('attendance-insights')&&holdSummary)await new Promise(resolve=>releaseSummary=resolve);
      if((failSummary&&path.endsWith('attendance-insights'))||(failReport&&path.endsWith('attendance-report'))) {
        await route.fulfill({status:503,json:{error:path.endsWith('attendance-report')?'Synthetic provider unavailable':'Synthetic attendance unavailable'}});return;
      }
      if(path.endsWith('attendance-report'))await route.fulfill({json:{text:'Synthetic report draft <img src=x onerror=alert(1)>',model:'synthetic-model',status:'draft',summary:summary(body)}});
      else await route.fulfill({json:summary(body)});
    });
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
    try {
      await page.goto(origin+'/assistant');await page.getByRole('heading',{name:'GWCC Pastoral AI Agent & Studio'}).waitFor();
      assert.equal(await page.getByText(/gemini-3.8|Gemini 3.8/).count(),0);
      const panel=page.getByRole('region',{name:'Attendance Intelligence'});
      if(role==='finance_officer') {assert.equal(await panel.count(),0);assert.equal(requests.length,0);continue;}
      await panel.waitFor();assert.equal(await page.getByLabel('Attendance start date').inputValue(),start);
      await panel.getByRole('button',{name:'View attendance summary',exact:true}).click();
      await panel.getByText('3 recorded check-ins (2 member; 1 visitor)',{exact:true}).waitFor();
      await panel.getByRole('button',{name:'Draft attendance report',exact:true}).click();
      await panel.getByRole('article',{name:'Attendance report draft'}).waitFor();
      await panel.getByText('Draft — review before sharing',{exact:true}).waitFor();
      assert.equal(await panel.locator('img').count(),0,'Model HTML must be rendered as text');
      const nextStart=new Date(Date.now()-5*86400000).toISOString().slice(0,10);
      await page.getByLabel('Attendance start date').fill(nextStart);
      assert.equal(await panel.getByRole('article').count(),0);assert.equal(await panel.getByText(/3 recorded check-ins/).count(),0);
      failSummary=true;await panel.getByRole('button',{name:'View attendance summary',exact:true}).click();
      await panel.getByRole('alert').filter({hasText:'Synthetic attendance unavailable'}).waitFor();
      assert.equal(await panel.getByText(/recorded check-ins \(/).count(),0);
      failSummary=false;empty=true;await panel.getByRole('button',{name:'View attendance summary',exact:true}).click();
      await panel.getByText('No present check-ins found in the selected period. This does not confirm that no service took place.',{exact:true}).waitFor();
      failReport=true;await panel.getByRole('button',{name:'Draft attendance report',exact:true}).click();
      await panel.getByRole('alert').filter({hasText:'Synthetic provider unavailable'}).waitFor();assert.equal(await panel.getByRole('article').count(),0);
      holdSummary=true;await panel.getByRole('button',{name:'View attendance summary',exact:true}).click();
      for(let i=0;!releaseSummary&&i<30;i++)await new Promise(r=>setTimeout(r,20));assert.ok(releaseSummary);
      await page.getByLabel('Attendance start date').fill(start);releaseSummary();holdSummary=false;
      await page.waitForTimeout(100);assert.equal(await panel.getByText(/recorded check-ins \(/).count(),0,'Old period response must stay discarded');
      await page.getByRole('button',{name:'Custom Theological Prompt',exact:true}).click();
      await page.locator('textarea').fill('Draft a synthetic sermon outline.');
      await page.getByRole('button',{name:'Generate with Gemini',exact:true}).click();
      await page.getByText('Synthetic sermon draft',{exact:true}).waitFor();await page.getByText('Model: synthetic-model',{exact:true}).waitFor();
      assert.equal(await page.evaluate(()=>Object.values(localStorage).some(value=>value.includes('Synthetic sermon draft')||value.includes('Synthetic report draft'))),false);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),`AI layout overflows at ${width}`);
      assert.deepEqual(errors,[]);
      console.log(`AI agent ${role} ${width}px: summaries, draft privacy, stale dates, error states and safe text passed`);
    } finally {if(releaseSummary)releaseSummary();await context.close();}
  }
}
