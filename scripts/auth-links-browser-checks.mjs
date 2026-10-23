import assert from 'node:assert/strict';

export async function checkAuthLinks(browser,{origin,settings,sampleMember}) {
  for(const width of [390,1440]) {
    const fixture=async({signedIn=false,role='member',factors=0}={})=>{
      const context=await browser.newContext({viewport:{width,height:1000}});
      const id='55555555-5555-4555-8555-555555555555';
      const user={id,email:'email-link@example.test',email_confirmed_at:'2026-10-23T00:00:00Z',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{}};
      const factorId='77777777-7777-4777-8777-777777777777';
      if(factors)user.factors=[{id:factorId,factor_type:'totp',status:'verified',friendly_name:'Existing authenticator'}];
      const profile={id,email:user.email,first_name:'Email',last_name:'Link',role,is_active:true,has_login_account:true,authorization_reviewed_at:'2026-10-23T00:00:00Z'};
      const exp=Math.floor(Date.now()/1000)+3600;
      const tokenFor=aal=>`${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,session_id:id,aal,role:'authenticated',exp})).toString('base64url')}.${Buffer.from('synthetic').toString('base64url')}`;
      const token=tokenFor('aal1');
      const session={user,access_token:token,refresh_token:'synthetic-email-link-refresh',expires_at:exp,expires_in:3600,token_type:'bearer'};
      const own={...sampleMember,id:'email-link-member',member_id:'GWCC-EMAIL-LINK',first_name:'Email',last_name:'Link',auth_user_id:id};
      const writes=[],errors=[],reads=[];
      await context.addInitScript(({session,signedIn})=>{
        localStorage.setItem('gwcc_supabase_url','https://gwcc-e2e.supabase.co');localStorage.setItem('gwcc_supabase_anon_key','synthetic-public-key');
        if(signedIn)localStorage.setItem('gwcc-church-auth-token',JSON.stringify(session));
      },{session,signedIn});
      await context.route('https://gwcc-e2e.supabase.co/**',async route=>{
        const request=route.request(),url=new URL(request.url());
        const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','content-type':'application/json'};
        if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
        let result=[];
        if(url.pathname==='/auth/v1/user'){
          if(request.method()==='PUT'){
            assert.ok([token,tokenFor('aal2')].some(value=>request.headers().authorization===`Bearer ${value}`));
            if(factors)assert.equal(request.headers().authorization,`Bearer ${tokenFor('aal2')}`,'Password recovery must keep MFA verification');
            writes.push({path:url.pathname,passwordLength:request.postDataJSON().password.length});
          }
          result=user;
        }else if(url.pathname==='/auth/v1/token')result=session;
        else if(url.pathname==='/auth/v1/logout'){await route.fulfill({status:204,headers});return;}
        else if(url.pathname===`/auth/v1/factors/${factorId}/challenge`)result={id:'88888888-8888-4888-8888-888888888888',type:'totp',expires_at:exp};
        else if(url.pathname===`/auth/v1/factors/${factorId}/verify`){assert.equal(request.postDataJSON().code,'123456');result={...session,access_token:tokenFor('aal2')};}
        else if(url.pathname==='/rest/v1/rpc/gwcc_security_status')result={role,required:role!=='member',verified_factors:factors,satisfied:role==='member'||(factors>0&&request.headers().authorization===`Bearer ${tokenFor('aal2')}`)};
        else if(url.pathname==='/rest/v1/profiles')result=request.headers().accept?.includes('vnd.pgrst.object')?profile:[profile];
        else if(url.pathname==='/rest/v1/members'){reads.push('members');result=request.headers().accept?.includes('vnd.pgrst.object')?own:[own];}
        else if(url.pathname==='/rest/v1/settings'){reads.push('settings');result=[{id:'gwcc_global_settings',...settings}];}
        else if(url.pathname.startsWith('/rest/v1/'))reads.push(url.pathname.split('/').at(-1));
        await route.fulfill({status:200,headers,json:result});
      });
      const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
      const hash=purpose=>new URLSearchParams({type:purpose,access_token:token,refresh_token:session.refresh_token,token_type:'bearer',expires_in:'3600'}).toString();
      return {context,page,user,session,hash,writes,errors,reads};
    };
    const expired='#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';
    for(const signedIn of [false,true]) {
      const f=await fixture({signedIn});
      try {
        for(const path of ['/', '/login', '/auth/password']) {
          await f.page.goto(`${origin}${path}${expired}`);
          await f.page.getByRole('alert').filter({hasText:'invalid, expired, or already used'}).waitFor();
          assert.equal(new URL(f.page.url()).pathname,'/auth/password');
          assert.equal(new URL(f.page.url()).hash,'');
          assert.equal(await f.page.getByLabel('New password',{exact:true}).count(),0);
          assert.equal(f.writes.length,0);
        }
        await f.page.getByRole('link',{name:'Staff sign-in and password help',exact:true}).click();
        await f.page.getByRole('button',{name:'Sign In to Workspace',exact:true}).waitFor();
        await f.page.goto(`${origin}/auth/password`);
        await f.page.getByRole('alert').filter({hasText:'invalid, expired, or already used'}).waitFor();
        assert.equal(await f.page.getByLabel('New password',{exact:true}).count(),0);
        await f.page.goto(`${origin}/login?recovery=1`);
        await f.page.getByRole('alert').filter({hasText:'invalid, expired, or already used'}).waitFor();
        assert.equal(f.writes.length,0);assert.deepEqual(f.errors,[]);
      } finally {await f.context.close();}
    }
    for(const purpose of ['invite','recovery']) {
      const f=await fixture();
      try {
        await f.page.goto(`${origin}/${purpose==='recovery'?'login':''}#${f.hash(purpose)}`);
        await f.page.getByLabel('New password',{exact:true}).waitFor();
        await f.page.getByText(f.user.email,{exact:true}).waitFor();
        assert.equal(new URL(f.page.url()).pathname,'/auth/password');
        assert.equal(new URL(f.page.url()).hash,'');
        await f.page.getByLabel('New password',{exact:true}).fill('synthetic-email-password');
        await f.page.getByLabel('Confirm password',{exact:true}).fill('a-different-password');
        await f.page.getByRole('button',{name:'Save password',exact:true}).click();
        await f.page.getByRole('alert').filter({hasText:'passwords do not match'}).waitFor();assert.equal(f.writes.length,0);
        await f.page.getByLabel('Confirm password',{exact:true}).fill('synthetic-email-password');
        await f.page.getByRole('button',{name:'Save password',exact:true}).click();
        await f.page.getByRole('status').filter({hasText:'Your password has been saved.'}).waitFor({timeout:5000}).catch(async error=>{throw new Error(`${purpose} setup failed: ${await f.page.locator('body').innerText()} ${JSON.stringify(f.errors)} ${error.message}`);});assert.equal(f.writes.length,1);
        await f.page.getByRole('link',{name:'Continue to Member Portal',exact:true}).click();await f.page.waitForURL('**/portal');
        assert.ok(await f.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Email setup overflows viewport');
        assert.deepEqual(f.errors,[]);
      } finally {await f.context.close();}
    }
    {
      const f=await fixture({role:'finance_officer'});
      try {
        await f.page.goto(`${origin}/auth/password#${f.hash('invite')}`);
        await f.page.getByLabel('New password',{exact:true}).fill('synthetic-staff-password');
        await f.page.getByLabel('Confirm password',{exact:true}).fill('synthetic-staff-password');
        await f.page.getByRole('button',{name:'Save password',exact:true}).click();
        await f.page.getByRole('status').filter({hasText:'Your password has been saved.'}).waitFor();
        assert.equal(f.reads.length,0,'Staff must not read private records before MFA');
        await f.page.getByRole('link',{name:'Continue to sign in',exact:true}).click();
        await f.page.getByRole('region',{name:'Two-factor authentication'}).getByRole('button',{name:'Start authenticator setup',exact:true}).waitFor();
        assert.equal(f.reads.length,0);assert.equal(f.writes.length,1);assert.deepEqual(f.errors,[]);
      } finally {await f.context.close();}
    }
    {
      const f=await fixture({role:'finance_officer',factors:1});
      try {
        await f.page.goto(`${origin}/auth/password${expired}`);
        await f.page.getByRole('alert').filter({hasText:'invalid, expired, or already used'}).waitFor();
        assert.equal(await f.page.getByRole('region',{name:'Two-factor authentication'}).count(),0);assert.equal(f.writes.length,0);
        await f.page.goto(`${origin}/login#${f.hash('recovery')}`);
        const panel=f.page.getByRole('region',{name:'Two-factor authentication'});
        await panel.getByRole('button',{name:'Verify and continue',exact:true}).waitFor();
        assert.equal(f.writes.length,0);assert.equal(f.reads.length,0);
        await panel.getByLabel('Six-digit code',{exact:true}).fill('123456');
        await panel.getByRole('button',{name:'Verify and continue',exact:true}).click();
        await f.page.getByLabel('New password',{exact:true}).fill('synthetic-recovery-password');
        await f.page.getByLabel('Confirm password',{exact:true}).fill('synthetic-recovery-password');
        await f.page.getByRole('button',{name:'Save password',exact:true}).click();
        await f.page.getByRole('status').filter({hasText:'Your password has been saved.'}).waitFor();
        assert.equal(f.writes.length,1);assert.deepEqual(f.errors,[]);
      } finally {await f.context.close();}
    }
    {
      const f=await fixture();
      try {
        await f.page.goto(`${origin}/auth/password#${f.hash('recovery')}`);
        await f.page.getByLabel('New password',{exact:true}).fill('synthetic-email-password');
        await f.page.getByLabel('Confirm password',{exact:true}).fill('synthetic-email-password');
        await f.page.evaluate(session=>localStorage.setItem('gwcc-church-auth-token',JSON.stringify({...session,user:{...session.user,id:'66666666-6666-4666-8666-666666666666'}})),f.session);
        await f.page.getByRole('button',{name:'Save password',exact:true}).click();
        await f.page.getByRole('alert').filter({hasText:'signed-in account changed'}).waitFor();assert.equal(f.writes.length,0);
        assert.equal(await f.page.getByLabel('New password',{exact:true}).count(),0);
        await f.page.reload();
        await f.page.getByRole('alert').filter({hasText:'invalid, expired, or already used'}).waitFor();assert.equal(f.writes.length,0);
      } finally {await f.context.close();}
    }
  }
  console.info('Email-link browser checks passed: mobile/desktop invalid and expired callbacks, existing sessions, valid invitation/recovery, account switches, no-link reloads, staff password setup and MFA.');
}
