import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import {initialSettings,sampleMembers} from '../src/lib/initialData.ts';

const port=Number(process.env.TEST_PORT||3401),origin=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['--import','tsx','server.ts'],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'production',PORT:String(port),SUPABASE_URL:'https://gwcc-e2e.supabase.co',SUPABASE_ANON_KEY:'test-public-key'},stdio:'pipe'});
let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);
let browser;
try{
  let ready=false;
  for(let attempt=0;attempt<100;attempt++){
    if(child.exitCode!==null)throw new Error(`Test server exited: ${output}`);
    try{if((await fetch(`${origin}/api/health`)).ok){ready=true;break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.ok(ready,'Production server did not start.');
  const unauthenticated=await fetch(`${origin}/api/ai/assistant`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:'Test'})});assert.equal(unauthenticated.status,401);
  const invalidJson=await fetch(`${origin}/api/staff`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{bad'});assert.equal(invalidJson.status,400);
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{channel:'chromium'}),args:['--no-sandbox']});
  const errors=[];
  const unsigned=await browser.newContext({viewport:{width:390,height:844}});
  await unsigned.addInitScript(()=>{localStorage.setItem('gwcc_auth_authenticated','true');localStorage.setItem('gwcc_active_user',JSON.stringify({id:'forged',role:'super_admin'}));localStorage.setItem('members',JSON.stringify([{first_name:'Hidden private data'}]));});
  const phonePage=await unsigned.newPage();phonePage.on('pageerror',error=>errors.push(error.message));
  await phonePage.goto(`${origin}/members`);await phonePage.waitForURL('**/login');
  assert.equal(await phonePage.getByText('Hidden private data').count(),0);
  assert.ok(await phonePage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Mobile sign-in overflows.');
  await phonePage.goto(`${origin}/portal`);await phonePage.getByText('Member Portal', {exact:false}).first().waitFor();
  assert.equal(await phonePage.getByText('Hidden private data').count(),0);await unsigned.close();

  const id='11111111-1111-4111-8111-111111111111';
  const user={id,email:'qa@example.test',email_confirmed_at:'2026-10-15T00:00:00Z',created_at:'2026-10-15T00:00:00Z',app_metadata:{provider:'email'},user_metadata:{first_name:'QA',last_name:'Admin'},aud:'authenticated',role:'authenticated'};
  const profile={id,email:user.email,first_name:'QA',last_name:'Admin',role:'super_admin',is_active:true,has_login_account:true,authorization_reviewed_at:'2026-10-15T00:00:00Z'};
  const exp=Math.floor(Date.now()/1000)+3600;
  const token=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,role:'authenticated',exp})).toString('base64url')}.test-signature`;
  const session={user,access_token:token,refresh_token:'qa-refresh-token',expires_at:exp,expires_in:3600,token_type:'bearer'};
  const data={members:[{...sampleMembers[0],id:'qa-member',first_name:'QA',last_name:'Member',member_id:'GWCC-900001',auth_user_id:null}],settings:[{id:'gwcc_global_settings',...initialSettings}],profiles:[profile]};
  data.welfare_contributions=[{id:'qa-dues',member_id:'qa-member',member_name:'QA Member',amount:10895,date:'2026-10-15',month:'2026-10',payment_method:'cash',recorded_by:'QA',created_at:'2026-10-15T00:00:00Z'}];
  data.welfare_claims=[];
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addInitScript(({session})=>{localStorage.setItem('gwcc_supabase_url','https://gwcc-e2e.supabase.co');localStorage.setItem('gwcc_supabase_anon_key','test-public-key');localStorage.setItem('gwcc-church-auth-token',JSON.stringify(session));},{session});
  let rejectWrites=true;const mutationRequests=[];
  await context.route('https://gwcc-e2e.supabase.co/**',async route=>{
    const request=route.request(),url=new URL(request.url());
    const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','content-type':'application/json'};
    if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
    let result=[];
    if(url.pathname==='/auth/v1/user')result=user;
    else if(url.pathname==='/auth/v1/token')result=session;
    else if(url.pathname==='/auth/v1/logout'){await route.fulfill({status:204,headers});return;}
    else if(url.pathname==='/rest/v1/rpc/gwcc_apply_mutations'){
      assert.equal(request.headers().authorization,`Bearer ${token}`);
      const body=request.postDataJSON();mutationRequests.push(body);
      if(rejectWrites){await route.fulfill({status:503,headers,body:JSON.stringify({message:'Test cloud unavailable; changes retained.'})});return;}
      result=body.p_changes.filter(change=>change.table!=='audit_logs').map(change=>({table:change.table,record:{...change.record,updated_at:new Date().toISOString()}}));
      for(const item of result){data[item.table]??=[];data[item.table]=[item.record,...data[item.table].filter(row=>row.id!==item.record.id)];}
    }else if(url.pathname.startsWith('/rest/v1/')){
      const table=url.pathname.split('/').at(-1);const rows=data[table]||[];
      const range=request.headers().range?.split('-').map(Number);const offset=Number(url.searchParams.get('offset')||range?.[0]||0),limit=Number(url.searchParams.get('limit')||500);
      result=rows.slice(offset,offset+limit);
      if(request.headers().accept?.includes('vnd.pgrst.object'))result=result[0]||null;
    }
    await route.fulfill({status:200,headers,body:JSON.stringify(result)});
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  const pages=['/','/members','/giving','/church-finance','/welfare','/pledges','/services','/reports','/users','/settings','/inventory','/pastoral-care','/communication'];
  for(const path of pages){
    await page.goto(`${origin}${path}`);await page.locator('main').waitFor();await page.waitForTimeout(100);
    assert.ok(!new URL(page.url()).pathname.startsWith('/login'),`Authenticated route failed: ${path}`);
    if(path==='/welfare'){
      const balanceCard=()=>page.getByText('Welfare Dues Balance',{exact:true}).locator('..').locator('..');
      await balanceCard().getByText('GH₵ 10,895.00',{exact:true}).waitFor();
      assert.equal(await page.getByText('GH₵ 26,295.00',{exact:true}).count(),0);
      await page.getByRole('button',{name:'Audit Report',exact:true}).click();
      const report=()=>page.getByRole('dialog',{name:'GWCC Welfare & Benevolence Mutual Fund Statement'});
      await report().getByText('Welfare Dues Balance',{exact:true}).locator('..').getByText('GH₵ 10895.00',{exact:true}).waitFor();
      await report().getByRole('button',{name:'Close welfare audit report'}).click();
      data.welfare_claims=[{id:'qa-claim',claim_number:'BEN-QA',member_id:'qa-member',member_name:'QA Member',category:'emergency_relief',title:'QA relief',description:'Synthetic browser check',amount_requested:1500,amount_approved:1000,amount_disbursed:250,status:'approved',emergency_level:'normal',date_submitted:'2026-10-15',created_at:'2026-10-15T00:00:00Z'}];
      await page.reload();
      await balanceCard().getByText('GH₵ 10,645.00',{exact:true}).waitFor();
      await page.getByText('Benevolence Disbursed',{exact:true}).locator('..').locator('..').getByText('GH₵ 250.00',{exact:true}).waitFor();
      await page.getByRole('button',{name:'Audit Report',exact:true}).click();
      await report().getByText('Welfare Dues Balance',{exact:true}).locator('..').getByText('GH₵ 10645.00',{exact:true}).waitFor();
      await report().getByText('Relief Disbursed',{exact:true}).locator('..').getByText('GH₵ 250.00',{exact:true}).waitFor();
      await report().getByRole('button',{name:'Close welfare audit report'}).click();
    }
  }
  await page.getByLabel('Title',{exact:true}).fill('QA saved draft');
  await page.getByLabel('Message',{exact:true}).fill('This is a draft. Nothing was sent.');
  await page.getByRole('button',{name:'Save draft',exact:true}).click();
  await page.getByText('Test cloud unavailable; changes retained.').waitFor();
  assert.ok(mutationRequests.length>0);const firstId=mutationRequests[0].p_operation_id;
  await page.reload();await page.getByText('QA saved draft',{exact:true}).waitFor();
  await page.getByText('Test cloud unavailable; changes retained.').waitFor();
  assert.equal(mutationRequests.at(-1).p_operation_id,firstId);
  rejectWrites=false;await page.getByRole('button',{name:'Retry sync',exact:true}).click();
  await page.waitForFunction(id=>JSON.parse(localStorage.getItem(`gwcc_outbox_v2_${id}`)||'[]').length===0,id);
  assert.equal(data.communications[0].status,'draft');
  await page.getByRole('button',{name:/Sign Out|Log Out|Logout/i}).first().click();await page.waitForURL('**/login');
  assert.equal(await page.evaluate(id=>Object.keys(localStorage).filter(key=>key.startsWith(`gwcc_cache_${id}_`)).length,id),0);
  assert.deepEqual(errors,[]);
  console.info(`Browser smoke passed: mobile authorization, ${pages.length} signed-in pages, durable draft retry, and logout cache clearing.`);
}finally{
  if(browser)await browser.close();child.kill('SIGTERM');
}
