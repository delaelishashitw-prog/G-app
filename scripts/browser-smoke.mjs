import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import {initialSettings,sampleMembers} from '../src/lib/initialData.ts';
import {serviceFixtures,checkServices} from './services-browser-checks.mjs';
import {attendanceFixtures,checkAttendance} from './attendance-browser-checks.mjs';
import {checkPublicMemberLogin,checkMemberAccess,checkMemberPasswordSetup} from './member-access-browser-checks.mjs';
import {watchSyncStatus,waitForSync} from './sync-browser-utils.mjs';
import {checkStorageQuota} from './storage-quota-browser-checks.mjs';
import {checkOperationRecovery} from './operation-recovery-browser-checks.mjs';

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
  if(process.env.TEST_SCOPE==='storage'){
    await checkStorageQuota(browser,{origin,settings:initialSettings,sampleMember:sampleMembers[0]});
  }else if(process.env.TEST_SCOPE==='recovery'){
    await checkOperationRecovery(browser,{origin,settings:initialSettings,sampleMember:sampleMembers[0]});
  }else{
  const errors=[];
  const unsigned=await browser.newContext({viewport:{width:390,height:844}});
  await unsigned.addInitScript(()=>{localStorage.setItem('gwcc_supabase_url','https://gwcc-e2e.supabase.co');localStorage.setItem('gwcc_supabase_anon_key','test-public-key');localStorage.setItem('gwcc_auth_authenticated','true');localStorage.setItem('gwcc_active_user',JSON.stringify({id:'forged',role:'super_admin'}));localStorage.setItem('members',JSON.stringify([{first_name:'Hidden private data'}]));});
  const phonePage=await unsigned.newPage();phonePage.on('pageerror',error=>errors.push(error.message));
  await phonePage.goto(`${origin}/members`);await phonePage.waitForURL('**/login');
  assert.equal(await phonePage.getByText('Hidden private data').count(),0);
  assert.ok(await phonePage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Mobile sign-in overflows.');
  await phonePage.goto(`${origin}/portal`);await phonePage.getByText('Member Portal', {exact:false}).first().waitFor();
  assert.equal(await phonePage.getByText('Hidden private data').count(),0);
  await checkPublicMemberLogin(phonePage,unsigned,{origin});await unsigned.close();

  const id='11111111-1111-4111-8111-111111111111';
  const user={id,email:'qa@example.test',email_confirmed_at:'2026-10-15T00:00:00Z',created_at:'2026-10-15T00:00:00Z',app_metadata:{provider:'email'},user_metadata:{first_name:'QA',last_name:'Admin'},aud:'authenticated',role:'authenticated'};
  const profile={id,email:user.email,first_name:'QA',last_name:'Admin',role:'super_admin',is_active:true,has_login_account:true,authorization_reviewed_at:'2026-10-15T00:00:00Z'};
  const exp=Math.floor(Date.now()/1000)+3600;
  const token=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,role:'authenticated',exp})).toString('base64url')}.test-signature`;
  const session={user,access_token:token,refresh_token:'qa-refresh-token',expires_at:exp,expires_in:3600,token_type:'bearer'};
  const today=new Date();
  const month=offset=>new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth()+offset,1)).toISOString().slice(0,7);
  const data={members:[
    {...sampleMembers[0],id:'qa-member',first_name:'QA',last_name:'Member',member_id:'GWCC-900001',auth_user_id:null,membership_date:'2004-01-10',is_archived:false},
    {...sampleMembers[0],id:'qa-current',first_name:'QA',last_name:'Current',member_id:'GWCC-900002',auth_user_id:null,membership_date:'2004-01-10',is_archived:false},
    {...sampleMembers[0],id:'qa-new',first_name:'QA',last_name:'New',member_id:'GWCC-900003',auth_user_id:null,membership_date:'2004-01-10',is_archived:false},
    {...sampleMembers[0],id:'qa-first-payment',first_name:'QA',last_name:'First Payment',member_id:'GWCC-900004',auth_user_id:null,membership_date:'2004-01-10',is_archived:false},
  ],settings:[{id:'gwcc_global_settings',...initialSettings}],profiles:[profile]};
  const receipt=(id,memberId,offset,amount)=>({id,member_id:memberId,member_name:data.members.find(member=>member.id===memberId).first_name+' '+data.members.find(member=>member.id===memberId).last_name,amount,date:`${month(Math.min(offset,0))}-01`,month:month(offset),payment_method:'cash',recorded_by:'QA',created_at:`${month(0)}-15T00:00:00Z`});
  data.welfare_contributions=[receipt('qa-1','qa-member',-6,10000),receipt('qa-2','qa-member',-5,400),receipt('qa-3','qa-member',-4,350),receipt('qa-duplicate','qa-member',-4,95),{...receipt('qa-prepaid','qa-member',2,10),date:`${month(0)}-01`},...[-5,-4,-3].map((offset,index)=>receipt(`qa-current-${index}`,'qa-current',offset,10)),{...receipt('qa-first','qa-first-payment',0,10),date:today.toISOString().slice(0,10)}];
  data.welfare_claims=[];
  const serviceFixture=serviceFixtures(today);Object.assign(data,serviceFixture.tables);
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addInitScript(watchSyncStatus);
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
      result=body.p_changes.filter(change=>change.table!=='audit_logs').map(change=>change.operation==='delete'?{table:change.table,id:change.id,deleted:true}:{table:change.table,record:{...change.record,updated_at:new Date().toISOString()}});
      for(const item of result){data[item.table]??=[];data[item.table]=item.deleted?data[item.table].filter(row=>row.id!==item.id):[item.record,...data[item.table].filter(row=>row.id!==item.record.id)];}
    }else if(url.pathname.startsWith('/rest/v1/')){
      const table=url.pathname.split('/').at(-1);const rows=data[table]||[];
      const range=request.headers().range?.split('-').map(Number);const offset=Number(url.searchParams.get('offset')||range?.[0]||0),limit=Number(url.searchParams.get('limit')||500);
      result=rows.slice(offset,offset+limit);
      if(request.headers().accept?.includes('vnd.pgrst.object'))result=result[0]||null;
    }
    await route.fulfill({status:200,headers,body:JSON.stringify(result)});
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  const pages=process.env.TEST_SCOPE==='member'?['/members']:['/','/members','/giving','/church-finance','/welfare','/pledges','/services','/attendance','/reports','/users','/settings','/inventory','/pastoral-care','/communication'];
  let attendanceFixture;
  for(const path of pages){
    if(path==='/attendance'){attendanceFixture=attendanceFixtures(today,data.members);Object.assign(data,attendanceFixture.tables);}
    await page.goto(`${origin}${path}`);await page.locator('main').waitFor();await page.waitForTimeout(100);
    assert.ok(!new URL(page.url()).pathname.startsWith('/login'),`Authenticated route failed: ${path}`);
    if(path==='/services')await checkServices(page,{origin,data,profile,mutations:mutationRequests,setRejectWrites:value=>{rejectWrites=value;},userId:id,clock:serviceFixture.clock});
    if(path==='/attendance')await checkAttendance(page,{origin,data,profile,mutations:mutationRequests,setRejectWrites:value=>{rejectWrites=value;},userId:id,date:attendanceFixture.date,previous:attendanceFixture.previous});
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

      await page.getByRole('button',{name:'Member Standing & Balances',exact:true}).click();
      await page.getByText('Defaulters: 1 members',{exact:true}).waitFor();
      const defaulter=page.getByRole('row').filter({has:page.getByText('QA Member',{exact:true})});
      await defaulter.getByText('Defaulter — Partially eligible',{exact:true}).waitFor();
      await defaulter.getByText(`3 unpaid month(s) through ${month(-1)}. 3 distinct month(s) paid.`,{exact:true}).waitFor();
      await defaulter.getByText(`Welfare joining date: ${month(-6)}-01 (first dues payment)`,{exact:true}).waitFor();
      await defaulter.getByText('View unpaid months',{exact:true}).click();
      await defaulter.getByText([month(-3),month(-2),month(-1)].join(', '),{exact:true}).waitFor();
      await page.getByRole('row').filter({has:page.getByText('QA Current',{exact:true})}).getByText('Fully eligible',{exact:true}).waitFor();
      await page.getByRole('row').filter({has:page.getByText('QA New',{exact:true})}).getByText('Not enrolled — No welfare payment',{exact:true}).waitFor();
      const firstPayment=page.getByRole('row').filter({has:page.getByText('QA First Payment',{exact:true})});
      await firstPayment.getByText('Probation — Committee review',{exact:true}).waitFor();
      await firstPayment.getByText(`Welfare joining date: ${today.toISOString().slice(0,10)} (first dues payment)`,{exact:true}).waitFor();
      await firstPayment.getByText(`0 unpaid month(s) through ${month(-1)}. 1 distinct month(s) paid.`,{exact:true}).waitFor();
      await page.getByRole('button',{name:'Show defaulters',exact:true}).click();
      assert.equal(await page.getByRole('row').filter({has:page.getByText('QA Current',{exact:true})}).count(),0);
      const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV',exact:true}).click();
      const download=await downloadPromise;const chunks=[];for await(const chunk of await download.createReadStream())chunks.push(chunk);
      const csv=Buffer.concat(chunks).toString('utf8');assert.match(csv,/Defaulter — Partially eligible/);assert.match(csv,/Unpaid Completed Months/);assert.match(csv,/Welfare Joining Date \(First Payment\)/);assert.match(csv,new RegExp(`${month(-6)}-01`));assert.match(csv,new RegExp(month(-3)));assert.ok(!csv.includes('QA Current'));

      await page.getByRole('button',{name:'Apply for Relief Aid',exact:true}).click();
      const application=page.getByRole('dialog',{name:'Apply for Benevolence Aid'});
      await application.getByText('Defaulter — Partially eligible',{exact:true}).waitFor();
      await application.getByRole('button',{name:'External / Community',exact:true}).click();
      assert.equal(await application.getByText('Defaulter — Partially eligible',{exact:true}).count(),0);
      await application.getByRole('button',{name:'Close welfare application'}).click();

      await page.getByRole('button',{name:'Constitution & Eligibility Calculator',exact:true}).click();
      await page.getByLabel('Unpaid completed months (arrears)',{exact:true}).fill('3');
      await page.getByText('Defaulter — Partially eligible',{exact:true}).waitFor();
      await page.getByText('Committee decision required',{exact:true}).waitFor();
      await page.getByLabel('Unpaid completed months (arrears)',{exact:true}).fill('2');
      await page.getByText('Fully eligible',{exact:true}).waitFor();

      data.welfare_claims.push({id:'qa-pending',claim_number:'BEN-QA-PARTIAL',member_id:'qa-member',member_name:'QA Member',category:'emergency_relief',title:'QA partial review',description:'Synthetic committee amount check',amount_requested:1000,status:'pending',emergency_level:'normal',date_submitted:`${month(0)}-15`,created_at:`${month(0)}-15T00:00:00Z`});
      await page.reload();await page.getByRole('button',{name:/Benevolence Aid Claims/}).click();
      await page.getByRole('row').filter({has:page.getByText('BEN-QA-PARTIAL',{exact:true})}).getByRole('button',{name:'Review',exact:true}).click();
      const review=page.getByRole('dialog',{name:'Review Benevolence Claim'});
      await review.getByText('Defaulter — Partially eligible',{exact:true}).waitFor();
      assert.equal(await review.getByLabel('Approved aid (GHS)',{exact:true}).inputValue(),'');
      await review.getByLabel('Evaluation decision',{exact:true}).selectOption('approved');
      assert.equal(await review.getByLabel('Approved aid (GHS)',{exact:true}).evaluate(input=>input.checkValidity()),false);
      await review.getByLabel('Approved aid (GHS)',{exact:true}).fill('500');
      assert.equal(await review.getByRole('button',{name:'Generate Payment Voucher',exact:true}).count(),0);
      rejectWrites=false;const reviewSync=page.waitForResponse(response=>response.url().endsWith('/rpc/gwcc_apply_mutations'));
      await review.getByRole('button',{name:'Save Review',exact:true}).click();await reviewSync;
      await waitForSync(page);
      assert.ok(mutationRequests.some(request=>request.p_changes.some(change=>change.table==='welfare_claims'&&change.record.id==='qa-pending'&&change.record.amount_approved===500&&change.record.status==='approved')));
      rejectWrites=true;mutationRequests.length=0;
      await page.getByRole('row').filter({has:page.getByText('BEN-QA',{exact:true})}).getByRole('button',{name:'Review',exact:true}).click();
      assert.equal(await review.getByLabel('Approved aid (GHS)',{exact:true}).inputValue(),'1000');
      await review.getByRole('button',{name:'Close welfare claim review'}).click();

      await page.goto(`${origin}/portal?tab=welfare`);
      await page.getByRole('button',{name:'Open Staff Preview',exact:true}).click();
      await page.getByText('Defaulter — Partially eligible',{exact:true}).waitFor();
      await page.getByText(`3 unpaid month(s) through ${month(-1)}. 3 distinct month(s) paid.`,{exact:true}).waitFor();
      await page.getByText(`Welfare joining date: ${month(-6)}-01 (first dues payment)`,{exact:true}).waitFor();
      await page.selectOption('#staff-preview-select','qa-current');
      await page.getByText('Fully eligible',{exact:true}).waitFor();
      await page.selectOption('#staff-preview-select','qa-new');
      await page.getByText('Not enrolled — No welfare payment',{exact:true}).waitFor();
      await page.getByText('Arrears start only after the first welfare dues payment.',{exact:true}).waitFor();
    }
  }
  await checkMemberAccess(page,{origin,data,profile});
  await checkMemberPasswordSetup(browser,{origin,settings:initialSettings,sampleMember:sampleMembers[0]});
  await page.goto(`${origin}/communication`);
  await page.getByLabel('Title',{exact:true}).fill('QA saved draft');
  await page.getByLabel('Message',{exact:true}).fill('This is a draft. Nothing was sent.');
  await page.getByRole('button',{name:'Save draft',exact:true}).click();
  await page.getByText('Test cloud unavailable; changes retained.').waitFor();
  assert.ok(mutationRequests.length>0);const firstId=mutationRequests[0].p_operation_id;
  await page.reload();await page.getByText('QA saved draft',{exact:true}).waitFor();
  await page.getByText('Test cloud unavailable; changes retained.').waitFor();
  assert.equal(mutationRequests.at(-1).p_operation_id,firstId);
  rejectWrites=false;await page.getByRole('button',{name:'Retry sync',exact:true}).click();
  await waitForSync(page);
  assert.equal(data.communications[0].status,'draft');
  await page.getByRole('button',{name:/Sign Out|Log Out|Logout/i}).first().click();await page.waitForURL('**/login');
  assert.equal(await page.evaluate(id=>Object.keys(localStorage).filter(key=>key.startsWith(`gwcc_cache_${id}_`)).length,id),0);
  assert.deepEqual(errors,[]);
  await checkStorageQuota(browser,{origin,settings:initialSettings,sampleMember:sampleMembers[0]});
  await checkOperationRecovery(browser,{origin,settings:initialSettings,sampleMember:sampleMembers[0]});
  console.info(`Browser smoke passed: mobile authorization, ${pages.length} signed-in pages, member invitation/linking/suspension guards/password help/password setup/portal, welfare arrears/defaulter filters/CSV/partial claim approval/member portal, durable draft retry, and logout cache clearing.`);
  }
}finally{
  if(browser)await browser.close();child.kill('SIGTERM');
}
