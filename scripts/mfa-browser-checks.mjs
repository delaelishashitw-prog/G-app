import assert from 'node:assert/strict';
import {readSavedOutbox} from './sync-browser-utils.mjs';

export async function checkMfa(browser,{origin,settings}){
 for(const width of [390,1440]){
  const id='18181818-1818-4818-8818-181818181818',operation='19191919-1919-4919-8919-191919191919';
  const profile={id,email:'security@example.test',first_name:'Security',last_name:'QA',role:'finance_officer',is_active:true,has_login_account:true,authorization_reviewed_at:'2026-10-17T00:00:00Z'};
  const user={id,email:profile.email,email_confirmed_at:'2026-10-17T00:00:00Z',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{}};
  let factors=[],sequence=0,level='aal1',factorId=null,rejectStatus=false;const records=[],attempts=[],mutations=[],actions=[],errors=[];
  const exp=Math.floor(Date.now()/1000)+3600;
  const session=()=>({user:{...user,factors},access_token:`${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,role:'authenticated',session_id:id,aal:level,exp})).toString('base64url')}.test-signature`,refresh_token:'synthetic-security-refresh',expires_at:exp,expires_in:3600,token_type:'bearer'});
  const context=await browser.newContext({viewport:{width,height:1000}});
  const legacy={id:operation,createdAt:'2026-10-17T00:00:00Z',attempts:1,requiresReview:true,changes:[{table:'members',id:'held-mfa-work',operation:'upsert',record:{id:'held-mfa-work',first_name:'Held',last_name:'Work'}}]};
  await context.addInitScript(({session,id,legacy})=>{
   if(localStorage.getItem('gwcc-security-fixture'))return;localStorage.setItem('gwcc-security-fixture','yes');
   localStorage.setItem('gwcc_supabase_url','https://gwcc-e2e.supabase.co');localStorage.setItem('gwcc_supabase_anon_key','synthetic-public-key');localStorage.setItem('gwcc-church-auth-token',JSON.stringify(session));
   localStorage.setItem(`gwcc_cache_${id}_members`,JSON.stringify([{first_name:'Hidden cached church record'}]));localStorage.setItem(`gwcc_outbox_v2_${id}`,JSON.stringify([legacy]));
  },{session:session(),id,legacy});
  await context.route('https://gwcc-e2e.supabase.co/**',async route=>{
   const request=route.request(),url=new URL(request.url()),headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','content-type':'application/json'};
   if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
   let result=[];
   if(url.pathname==='/auth/v1/user')result={...user,factors};
   else if(url.pathname==='/auth/v1/token')result=session();
   else if(url.pathname==='/auth/v1/logout'){await route.fulfill({status:204,headers});return;}
   else if(url.pathname==='/auth/v1/factors'&&request.method()==='POST'){
    assert.ok(!factors.some(f=>f.status==='verified')||level==='aal2','Existing factor must be verified before backup enrollment.');
    const body=request.postDataJSON(),f={id:`20202020-2020-4020-8020-${String(++sequence).padStart(12,'0')}`,factor_type:'totp',friendly_name:body.friendly_name,status:'unverified',created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
    factors.push(f);actions.push({action:'enroll',id:f.id});
    result={id:f.id,type:'totp',friendly_name:f.friendly_name,totp:{qr_code:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="white"/><path d="M20 20h40v40H20zm80 0h40v40h-40zM20 100h40v40H20z" fill="black"/></svg>',secret:'SYNTHETICMFASETUPKEY',uri:'otpauth://totp/Synthetic?secret=SYNTHETICMFASETUPKEY'}};
   }else if(url.pathname.match(/\/auth\/v1\/factors\/[^/]+\/challenge$/))result={id:'21212121-2121-4121-8121-212121212121',type:'totp',expires_at:exp};
   else if(url.pathname.match(/\/auth\/v1\/factors\/[^/]+\/verify$/)){
    if(request.postDataJSON().code!=='123456'){await route.fulfill({status:422,headers,json:{code:'mfa_verification_failed',message:'Invalid TOTP code'}});return;}
    factorId=url.pathname.split('/').at(-2);const f=factors.find(f=>f.id===factorId);assert.ok(f);f.status='verified';level='aal2';actions.push({action:'verify',id:factorId});result=session();
   }else if(url.pathname.startsWith('/auth/v1/factors/')&&request.method()==='DELETE'){
    const target=url.pathname.split('/').at(-1),f=factors.find(f=>f.id===target);assert.ok(f);
    if(f.status==='verified'){assert.equal(level,'aal2');assert.notEqual(target,factorId,'Removal must follow verification of the device being kept.');}
    factors=factors.filter(f=>f.id!==target);actions.push({action:'remove',id:target});result={id:target};
   }else if(url.pathname==='/rest/v1/rpc/gwcc_security_status'){
    if(rejectStatus){await route.fulfill({status:503,headers,json:{message:'Synthetic security check unavailable'}});return;}
    const bearer=request.headers().authorization.split(' ')[1],claims=JSON.parse(Buffer.from(bearer.split('.')[1],'base64url').toString());
    result={role:profile.role,required:true,verified_factors:factors.filter(f=>f.status==='verified').length,satisfied:claims.aal==='aal2'&&level==='aal2'&&factors.some(f=>f.id===factorId&&f.status==='verified')};
   }else if(url.pathname==='/rest/v1/rpc/gwcc_apply_mutations'){mutations.push(request.postDataJSON());throw new Error('Held work must never be sent during MFA tests.');}
   else if(url.pathname.startsWith('/rest/v1/')){
    const table=url.pathname.split('/').at(-1);if(table!=='profiles'){attempts.push(table);const bearer=request.headers().authorization?.split(' ')[1];let claims;try{claims=JSON.parse(Buffer.from(bearer.split('.')[1],'base64url').toString());}catch{}if(claims?.aal!=='aal2'||level!=='aal2'){await route.fulfill({status:403,headers,json:{message:'Complete two-factor verification'}});return;}records.push(table);}
    const rows=table==='profiles'?[profile]:table==='settings'?[{id:'gwcc_global_settings',...settings}]:[];result=rows;
    if(request.headers().accept?.includes('vnd.pgrst.object'))result=rows[0]||null;
   }
   await route.fulfill({status:200,headers,json:result});
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/church-finance');const panel=page.getByRole('region',{name:'Two-factor authentication'});
  await panel.getByRole('button',{name:'Start authenticator setup',exact:true}).waitFor();
  assert.equal(records.length,0);assert.equal(attempts.length,0);assert.equal(await page.getByText('Hidden cached church record').count(),0);
  assert.equal(await page.evaluate(id=>localStorage.getItem(`gwcc_cache_${id}_members`),id),null);
  assert.ok(await page.evaluate(id=>localStorage.getItem(`gwcc_outbox_v2_${id}`)?.includes('held-mfa-work'),id));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'MFA setup overflows mobile.');
  await panel.getByLabel('Device name',{exact:true}).fill('Interrupted phone');await panel.getByRole('button',{name:'Start authenticator setup',exact:true}).click();
  await panel.getByAltText('Private authenticator setup QR code').waitFor();
  const persisted=await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}));assert.ok(!persisted.includes('SYNTHETICMFASETUPKEY'));
  await page.reload();await panel.getByText('Interrupted phone · Not verified').waitFor();
  assert.equal(await panel.getByAltText('Private authenticator setup QR code').count(),0);
  await panel.getByRole('button',{name:'Discard unfinished setup',exact:true}).click();await panel.getByText('Unfinished setup removed.',{exact:false}).waitFor();
  await panel.getByLabel('Device name',{exact:true}).fill('Primary phone');await panel.getByRole('button',{name:'Start authenticator setup',exact:true}).click();await panel.getByAltText('Private authenticator setup QR code').waitFor();
  await panel.getByLabel('Six-digit code',{exact:true}).fill('000000');await panel.getByRole('button',{name:'Verify authenticator',exact:true}).click();await panel.getByRole('alert').waitFor();assert.equal(records.length,0);assert.equal(attempts.length,0);assert.equal(mutations.length,0);
  await page.screenshot({path:`/workspace/scratch/643e5bedb30a/rollout-check/mfa-${width}.png`,fullPage:true});
  await panel.getByLabel('Six-digit code',{exact:true}).fill('123456');await panel.getByRole('button',{name:'Verify authenticator',exact:true}).click();
  await page.getByRole('heading',{name:'Church Finance',exact:false}).first().waitFor();assert.ok(records.length>0);
  const saved=await readSavedOutbox(page,id);assert.equal(saved.batches[0].id,operation);assert.equal(saved.batches[0].requiresReview,true);assert.equal(mutations.length,0);
  await page.goto(origin+'/account/security');await panel.getByText('Primary phone · Verified').waitFor();
  assert.equal(await panel.getByRole('button',{name:'Remove Primary phone',exact:true}).isDisabled(),true);
  await panel.getByLabel('Device name',{exact:true}).fill('Backup device');await panel.getByRole('button',{name:'Set up backup authenticator',exact:true}).click();await panel.getByLabel('Six-digit code',{exact:true}).fill('123456');await panel.getByRole('button',{name:'Verify authenticator',exact:true}).click();await panel.getByText('Backup device · Verified').waitFor();
  await panel.getByRole('button',{name:'Remove Primary phone',exact:true}).click();await panel.getByLabel('Remaining authenticator',{exact:true}).selectOption(factors.find(f=>f.friendly_name==='Backup device').id);
  await panel.getByLabel('Six-digit code',{exact:true}).fill('000000');await panel.getByRole('button',{name:'Verify backup and remove old device',exact:true}).click();await panel.getByRole('alert').waitFor();assert.equal(factors.filter(f=>f.status==='verified').length,2);
  await panel.getByLabel('Six-digit code',{exact:true}).fill('123456');await panel.getByRole('button',{name:'Verify backup and remove old device',exact:true}).click();await panel.getByText('Old authenticator removed.',{exact:false}).waitFor();assert.equal(factors.filter(f=>f.status==='verified').length,1);
  // A fresh password sign-in must challenge even though a verified device exists.
  level='aal1';await page.evaluate(session=>localStorage.setItem('gwcc-church-auth-token',JSON.stringify(session)),session());await page.reload();
  await panel.getByRole('button',{name:'Verify and continue',exact:true}).waitFor();assert.equal(await panel.getByRole('button',{name:'Start authenticator setup',exact:true}).count(),0);
  await panel.getByLabel('Six-digit code',{exact:true}).fill('123456');await panel.getByRole('button',{name:'Verify and continue',exact:true}).click();await panel.getByText('Backup device · Verified').waitFor();
  assert.equal(mutations.length,0);assert.deepEqual(errors,[]);
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.waitForURL('**/login');assert.equal((await readSavedOutbox(page,id)).batches[0].id,operation);
  rejectStatus=true;await page.evaluate(session=>localStorage.setItem('gwcc-church-auth-token',JSON.stringify(session)),session());const before=records.length;await page.goto(origin+'/church-finance');await page.waitForURL('**/login');assert.equal(records.length,before,'Unavailable security check must fail closed.');
  await context.close();
 }
 console.info('MFA browser checks passed: mobile/desktop enrollment, interrupted setup, invalid codes, no pre-MFA records, backup enrollment/removal, sign-in challenge, held work preservation and failed security checks.');
}
