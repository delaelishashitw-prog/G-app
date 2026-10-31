import assert from 'node:assert/strict';
export async function checkGivingDeposits(browser,{origin,settings}){
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'}),today=new Date().toISOString().slice(0,10),stamp=today+'T00:00:00Z';
  const id='11111111-1111-4111-8111-111111111111',user={id,email:'deposits@example.test',aud:'authenticated',role:'authenticated',email_confirmed_at:stamp,user_metadata:{},app_metadata:{provider:'email'}},profile={id,email:user.email,first_name:'Deposit',last_name:'Fixture',role:'super_admin',is_active:true,has_login_account:true,authorization_reviewed_at:stamp};
  const exp=Math.floor(Date.now()/1000)+3600,token=`${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,role:'authenticated',exp})).toString('base64url')}.synthetic`,session={user,access_token:token,refresh_token:'synthetic',expires_at:exp,expires_in:3600,token_type:'bearer'};
  const data={profiles:[profile],settings:[{id:'gwcc_global_settings',...settings}],church_accounts:[{id:'deposit-bank',name:'Deposit Bank',account_type:'bank',currency:'GHS',is_active:true,current_balance:500,opening_balance:300,updated_at:stamp}],church_finances:[{id:'existing-income',reference_no:'INC-EXISTING',title:'Already recorded collection',transaction_type:'income',account_id:'deposit-bank',account_name:'Deposit Bank',amount:200,giving_deposit_amount:0,currency:'GHS',status:'completed',date:today,payment_method:'bank_transfer',category:'Income',updated_at:stamp}],giving:[40,60,25].map((amount,i)=>({id:'giving-'+i,reference_number:'GIVING-'+i,donor_name:'Synthetic donor '+i,category:'Tithe',amount,currency:'GHS',date:today,payment_method:'bank_transfer',status:'completed',created_at:stamp,updated_at:stamp}))};
  data.giving.push({...data.giving[0],id:'void-giving',reference_number:'VOID',status:'voided'},{...data.giving[0],id:'unconfirmed',reference_number:'UNCONFIRMED',updated_at:null});
  const links=[],requests=[],responses=new Map(),errors=[];let linkFailure=true,interrupt=true,mutations=0;
  await context.addInitScript(({session})=>{localStorage.setItem('gwcc_supabase_url','https://gwcc-e2e.supabase.co');localStorage.setItem('gwcc_supabase_anon_key','test-public-key');localStorage.setItem('gwcc-church-auth-token',JSON.stringify(session));},{session});
  await context.route('https://gwcc-e2e.supabase.co/**',async route=>{
   const req=route.request(),url=new URL(req.url()),headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','content-type':'application/json'};
   if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
   let result=[];
   if(url.pathname==='/auth/v1/user')result=user;
   else if(url.pathname==='/auth/v1/token')result=session;
   else if(url.pathname==='/rest/v1/rpc/gwcc_security_status')result={role:'super_admin',required:true,verified_factors:1,satisfied:true};
   else if(url.pathname==='/rest/v1/rpc/gwcc_giving_deposit_links'){
    if(linkFailure){linkFailure=false;await route.fulfill({status:503,headers,json:{message:'Synthetic deposit list unavailable'}});return;}result=links;
   }else if(url.pathname==='/rest/v1/rpc/gwcc_post_giving_deposit'){
    const body=req.postDataJSON();requests.push(body);
    if(responses.has(body.p_operation_id))result=responses.get(body.p_operation_id);
    else{
     const rows=body.p_receipts.map(receipt=>data.giving.find(row=>row.id===receipt.id));
     assert.ok(rows.every(row=>row&&row.status==='completed'&&!links.some(link=>link.active&&link.giving_id===row.id)));
     const total=rows.reduce((sum,row)=>sum+row.amount,0);
     let finance=body.p_existing_finance_id?data.church_finances.find(row=>row.id===body.p_existing_finance_id):null;
     if(finance){assert.equal(finance.updated_at,body.p_expected_updated_at);assert.ok(finance.amount-finance.giving_deposit_amount>=total);}
     else{finance={...data.church_finances[0],id:'new-deposit',reference_no:'INC-NEW',title:'Member Giving treasury deposit',category:'Member Giving Deposit',date:body.p_date,payment_method:body.p_payment_method,amount:total,giving_deposit_amount:0};data.church_finances.push(finance);data.church_accounts[0].current_balance+=total;}
     finance.giving_deposit_amount+=total;finance.updated_at=new Date().toISOString();
     links.push(...rows.map(row=>({giving_id:row.id,finance_id:finance.id,amount:row.amount,active:true,linked_by_name:'Deposit Fixture',linked_at:finance.updated_at})));
     result=structuredClone(finance);responses.set(body.p_operation_id,result);
     if(!body.p_existing_finance_id&&interrupt){interrupt=false;await route.fulfill({status:503,headers,json:{message:'Synthetic lost deposit reply'}});return;}
    }
   }else if(url.pathname==='/rest/v1/rpc/gwcc_apply_mutations'){mutations++;await route.fulfill({status:403,headers,json:{message:'Unexpected generic mutation'}});return;}
   else if(url.pathname.startsWith('/rest/v1/')&&!url.pathname.includes('/rpc/')){
    const rows=data[url.pathname.split('/').at(-1)]||[],range=req.headers().range?.split('-').map(Number),offset=Number(url.searchParams.get('offset')||range?.[0]||0),limit=Number(url.searchParams.get('limit')||500);
    result=req.headers().accept?.includes('vnd.pgrst.object')?rows[0]||null:rows.slice(offset,offset+limit);
   }
   await route.fulfill({status:200,headers,body:JSON.stringify(result)});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(origin+'/church-finance');await page.getByRole('button',{name:'Giving Deposits',exact:true}).click();
   await page.getByRole('alert').filter({hasText:'Synthetic deposit list unavailable'}).waitFor();
   assert.equal(requests.length,0);await page.getByRole('button',{name:'Refresh deposits',exact:true}).click();
   await page.getByLabel('Select receipt GIVING-0',{exact:true}).waitFor();
   assert.equal(await page.getByLabel('Select receipt VOID',{exact:true}).count(),0);assert.equal(await page.getByLabel('Select receipt UNCONFIRMED',{exact:true}).count(),0);
   assert.equal(await page.getByLabel('Allocation action',{exact:true}).inputValue(),'existing');
   await page.getByLabel('Select receipt GIVING-0',{exact:true}).check();await page.getByLabel('Select receipt GIVING-1',{exact:true}).check();
   await page.getByLabel('Deposit holding account',{exact:true}).selectOption('deposit-bank');await page.getByLabel('Existing treasury income',{exact:true}).selectOption('existing-income');
   assert.equal(await page.getByRole('button',{name:'Link Giving receipts',exact:true}).isDisabled(),true);
   await page.getByRole('checkbox',{name:'I verified that these Giving receipts are included in the selected existing income receipt.',exact:true}).check();
   await page.getByRole('button',{name:'Link Giving receipts',exact:true}).click();await page.getByRole('status').filter({hasText:'existing account credit was preserved'}).waitFor();
   assert.equal(data.church_accounts[0].current_balance,500);assert.equal(links.length,2);
   await page.getByLabel('Select receipt GIVING-2',{exact:true}).check();await page.getByLabel('Allocation action',{exact:true}).selectOption('new');await page.getByLabel('Deposit method',{exact:true}).selectOption('bank_transfer');
   await page.getByRole('checkbox',{name:/I verified these receipts and confirm/}).check();await page.getByRole('button',{name:'Post Giving deposit',exact:true}).click();
   await page.getByRole('alert').filter({hasText:'Synthetic lost deposit reply'}).waitFor();assert.equal(data.church_accounts[0].current_balance,525);
   await page.getByRole('button',{name:'Post Giving deposit',exact:true}).click();await page.getByRole('status').filter({hasText:'deposit is posted once'}).waitFor();
   assert.equal(requests.length,3);assert.deepEqual(requests[1],requests[2]);assert.equal(data.church_finances.filter(row=>row.id==='new-deposit').length,1);assert.equal(data.church_accounts[0].current_balance,525);
   await page.getByText(/Giving allocation history/).click();await page.getByRole('cell',{name:'INC-NEW',exact:true}).waitFor();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Giving deposits overflow on mobile.');
   if(process.env.FINANCE_QA_SCREENSHOT_DIR)await page.screenshot({path:`${process.env.FINANCE_QA_SCREENSHOT_DIR}/giving-deposits-${width}.png`,fullPage:true});
   await page.reload();await page.getByRole('button',{name:'Giving Deposits',exact:true}).click();await page.getByText('No matching unallocated receipts.',{exact:true}).waitFor();
   assert.equal(requests.length,3);assert.equal(mutations,0);assert.deepEqual(errors,[]);
  }finally{await context.close();}
 }
 console.info('Giving deposit browser checks passed: failed-read retry, explicit review, confirmed-only selection, existing-income allocation with unchanged balance, interrupted new deposit retry with stable operation, once-only credit, persisted history, reload, no generic writes, and mobile/desktop layout.');
}
