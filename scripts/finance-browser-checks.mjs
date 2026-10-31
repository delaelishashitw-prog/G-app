import assert from 'node:assert/strict';
import {watchSyncStatus,waitForSync,retrySyncOrAwait} from './sync-browser-utils.mjs';
import {accountEffect} from '../src/lib/ledgerUtils.ts';

const modal=(page,title)=>page.getByRole('heading',{name:title,exact:true}).locator('xpath=ancestor::div[contains(@class,"fixed")][1]');
async function download(page,name){
  const event=page.waitForEvent('download');await page.getByRole('button',{name,exact:true}).click();
  const file=await event,chunks=[];for await(const chunk of await file.createReadStream())chunks.push(chunk);
  return Buffer.concat(chunks);
}

export async function checkChurchFinance(browser,{origin,settings}){
  const today=new Date().toISOString().slice(0,10),year=today.slice(0,4),lastYear=String(Number(year)-1);
  const owner='12121212-1212-4212-8212-121212121212';
  const user={id:owner,email:'finance-qa@example.test',email_confirmed_at:today+'T00:00:00Z',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{}};
  const profile={id:owner,email:user.email,role:'super_admin',first_name:'Synthetic',last_name:'Treasurer',is_active:true,has_login_account:true,authorization_reviewed_at:today+'T00:00:00Z'};
  const exp=Math.floor(Date.now()/1000)+3600,token=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:owner,role:'authenticated',exp})).toString('base64url')}.test-signature`;
  const session={user,access_token:token,refresh_token:'test-refresh',expires_at:exp,expires_in:3600,token_type:'bearer'};
  const base={account_id:'qa-bank',account_name:'Synthetic Bank',category:'Maintenance',currency:'GHS',date:today,payment_method:'cash',recorded_by:'Synthetic Treasurer',department:'Facilities',updated_at:today+'T00:00:00Z'};
  const fixture={profiles:[profile],settings:[{id:'gwcc_global_settings',...settings}],church_accounts:[
    {id:'qa-bank',name:'Synthetic Bank',account_type:'bank',bank_or_provider:'Synthetic Bank',currency:'GHS',current_balance:1000.25,opening_balance:1000.25,is_active:true,updated_at:base.updated_at},
    {id:'qa-cash',name:'Synthetic Cash',account_type:'cash_petty',bank_or_provider:'Cash on Hand',currency:'GHS',current_balance:0,opening_balance:0,is_active:true,updated_at:base.updated_at}
  ],church_finances:[
    {...base,id:'other-request',title:'Independent request',recipient_or_vendor:'Synthetic Vendor',amount:20,department:'Treasury',transaction_type:'expense',status:'pending',reference_no:'VCH-REVIEW',approval_state:'requested',requested_by_id:'34343434-3434-4434-8434-343434343434',requested_by:'Independent Requester',requested_at:base.updated_at,approval_history:[{action:'requested',actor_id:'34343434-3434-4434-8434-343434343434',actor_name:'Independent Requester',at:base.updated_at}]},
    {...base,id:'active-expense',title:'=1+1',recipient_or_vendor:'Vendor "North", A',amount:100.25,transaction_type:'expense',status:'completed',reference_no:'REF#1'},
    {...base,id:'void-expense',title:'Voided expense',amount:900,transaction_type:'expense',status:'voided',reference_no:'REF-VOID'},
    {...base,id:'pending-income',title:'Pending income',amount:500,transaction_type:'income',status:'pending',reference_no:'REF-PENDING'},
    {...base,id:'old-expense',title:'Prior year expense',date:lastYear+'-01-01',amount:40,transaction_type:'expense',status:'completed',reference_no:'REF#1'},
    {...base,id:'missing-account',account_id:'qa-deleted',account_name:'Historical Cash',title:'Historical receipt',amount:3,transaction_type:'income',status:'completed',reference_no:'REF-OLD'}
  ],services:[{id:'qa-service',name:'Synthetic Sunday',type:'sunday',day_of_week:'Sunday',start_time:'08:00',end_time:'10:30',is_active:true}],department_budgets:[]};
  async function setup(withCash=true){
    const data=structuredClone(fixture);if(!withCash)data.church_accounts.pop();
    const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    await context.addInitScript(watchSyncStatus);
    await context.addInitScript(()=>{window.__receiptMode='ok';window.__receiptWrites=[];Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__receiptWrites.push(text);if(window.__receiptMode==='deny')throw new DOMException('Clipboard denied','NotAllowedError');if(window.__receiptMode==='hold')await new Promise(resolve=>window.__receiptResolve=resolve);}}});});
    await context.addInitScript(({session})=>{localStorage.setItem('gwcc_supabase_url','https://gwcc-e2e.supabase.co');localStorage.setItem('gwcc_supabase_anon_key','test-public-key');localStorage.setItem('gwcc-church-auth-token',JSON.stringify(session));},{session});
    let rejectWrites=true,number=0,interruptPayment=true;const requests=[],actions=[],actionResults=new Map();
    await context.route('https://gwcc-e2e.supabase.co/**',async route=>{
      const request=route.request(),url=new URL(request.url()),headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','content-type':'application/json'};
      if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
      let result=[];
      if(url.pathname==='/rest/v1/rpc/gwcc_security_status')result={role:profile.role,required:profile.role!=="member",verified_factors:profile.role==="member"?0:1,satisfied:true};
    else if(url.pathname==='/auth/v1/user')result=user;
      else if(url.pathname==='/auth/v1/token')result=session;
      else if(url.pathname==='/rest/v1/rpc/gwcc_apply_mutations'){
        assert.equal(request.headers().authorization,`Bearer ${token}`);
        const body=request.postDataJSON();requests.push(body);
        if(rejectWrites){await route.fulfill({status:503,headers,body:JSON.stringify({message:'Synthetic finance cloud unavailable'})});return;}
        result=body.p_changes.filter(change=>change.table!=='audit_logs').map(change=>{
          if(change.operation==='delete')return {table:change.table,id:change.id,deleted:true};
          const record={...change.record,updated_at:new Date().toISOString()};delete record._sync_status;
          if(change.table==='church_finances'){
            if(record.reference_no.startsWith('PENDING-'))record.reference_no=`${['expense','disbursement','transfer'].includes(record.transaction_type)?'VCH':'INC'}-${year}-${String(++number).padStart(6,'0')}`;
            if(['expense','disbursement','transfer'].includes(record.transaction_type)){Object.assign(record,{status:'pending',approval_state:'requested',requested_by_id:owner,requested_by:'Synthetic Treasurer',requested_at:record.updated_at,approved_by:null,approved_by_id:null,approval_history:[{action:'requested',actor_id:owner,actor_name:'Synthetic Treasurer',at:record.updated_at}]});}
            const before=data.church_finances.find(row=>row.id===record.id);
            data.church_accounts=data.church_accounts.map(account=>({...account,current_balance:account.current_balance+(accountEffect(record,account.id)-accountEffect(before,account.id))/100}));
          }
          return {table:change.table,record};
        });
        for(const item of result){data[item.table]??=[];data[item.table]=item.deleted?data[item.table].filter(row=>row.id!==item.id):[item.record,...data[item.table].filter(row=>row.id!==item.record.id)];}
      }else if(url.pathname==='/rest/v1/rpc/gwcc_finance_approval_action'){
        const body=request.postDataJSON();actions.push(body);
        if(actionResults.has(body.p_operation_id)){result=actionResults.get(body.p_operation_id);}
        else{
          const before=data.church_finances.find(row=>row.id===body.p_finance_id);assert.equal(before.updated_at,body.p_expected_updated_at);
          const record={...before,updated_at:new Date().toISOString()};
          if(body.p_action==='approve'){assert.notEqual(before.requested_by_id,owner);Object.assign(record,{approval_state:'approved',approved_by_id:owner,approved_by:'Synthetic Treasurer',approved_at:record.updated_at});}
          else if(body.p_action==='paid'){assert.equal(before.approval_state,'approved');assert.ok(body.p_payment_reference);Object.assign(record,{approval_state:'paid',status:'completed',paid_by_id:owner,paid_by:'Synthetic Treasurer',paid_at:record.updated_at,payment_reference:body.p_payment_reference});}
          else if(body.p_action==='cancel'||body.p_action==='reject'){Object.assign(record,{approval_state:body.p_action==='cancel'?'cancelled':'rejected',status:'cancelled'});}
          record.approval_history=[...before.approval_history,{action:body.p_action,actor_id:owner,actor_name:'Synthetic Treasurer',at:record.updated_at,payment_reference:body.p_payment_reference,reason:body.p_reason}];
          data.church_finances=data.church_finances.map(row=>row.id===record.id?record:row);data.church_accounts=data.church_accounts.map(account=>({...account,current_balance:account.current_balance+(accountEffect(record,account.id)-accountEffect(before,account.id))/100}));
          actionResults.set(body.p_operation_id,record);result=record;
          if(body.p_action==='paid'&&interruptPayment){interruptPayment=false;await route.fulfill({status:503,headers,body:JSON.stringify({message:'Synthetic interrupted payment confirmation'})});return;}
        }
      }else if(url.pathname.startsWith('/rest/v1/')){
        const rows=data[url.pathname.split('/').at(-1)]||[],offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||500);
        result=rows.slice(offset,offset+limit);if(request.headers().accept?.includes('vnd.pgrst.object'))result=result[0]||null;
      }
      await route.fulfill({status:200,headers,body:JSON.stringify(result)});
    });
    const page=await context.newPage(),errors=[];page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin+'/church-finance');await page.getByText('Synthetic Bank',{exact:true}).first().waitFor();
    return {context,page,data,requests,actions,errors,setReject:value=>{rejectWrites=value;}};
  }
  const durability=await setup();
  try{
    const {page,requests,data,setReject}=durability;
    await page.getByRole('button',{name:'Record Income',exact:true}).click();
    const income=modal(page,'Record Church Income');
    await income.getByLabel('Revenue Title / Purpose *',{exact:true}).fill('Durable device income');
    await income.getByLabel('Amount (GH₵) *',{exact:true}).fill('12.34');
    await page.evaluate(()=>{window.__financeOriginalPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,...args){if(this.name==='outboxes'&&value.batches?.length)throw new DOMException('Synthetic finance device full','QuotaExceededError');return window.__financeOriginalPut.call(this,value,...args);};});
    await income.locator('button[type="submit"]').click();
    await page.getByText(/Synthetic finance device full/).first().waitFor();
    assert.equal(await income.isVisible(),true,'Storage failure must keep the income form open.');
    assert.equal(await income.getByLabel('Amount (GH₵) *',{exact:true}).inputValue(),'12.34');
    assert.equal(requests.length,0,'No cloud request can precede durable device admission.');
    assert.equal(data.church_accounts[0].current_balance,1000.25);
    await page.evaluate(()=>{IDBObjectStore.prototype.put=window.__financeOriginalPut;});
    await income.locator('button[type="submit"]').click();
    await page.getByText('Income awaiting confirmation',{exact:true}).waitFor();
    await page.getByText('Synthetic finance cloud unavailable',{exact:true}).first().waitFor();
    await page.getByRole('button',{name:'Close receipt or voucher',exact:true}).click();
    setReject(false);await retrySyncOrAwait(page);
    assert.equal(data.church_finances.filter(row=>row.title==='Durable device income').length,1);
    await page.goto(origin+'/giving');
    await page.getByRole('button',{name:'Record Member Giving',exact:true}).click();
    await page.getByPlaceholder('e.g. Visitor Kwesi Badu',{exact:true}).fill('Synthetic giving donor');
    await page.getByPlaceholder('0.00',{exact:true}).fill('7.50');
    setReject(true);
    await page.getByRole('button',{name:'Save Giving Record',exact:true}).click();
    await page.getByText('Receipt awaiting confirmation',{exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Print / PDF',exact:true}).isDisabled(),true);
    assert.equal(await page.getByText('Awaiting cloud confirmation. An official receipt will be available after the church database confirms this giving entry.',{exact:true}).isVisible(),true);
    setReject(false);await page.evaluate(()=>window.dispatchEvent(new Event('online')));await waitForSync(page);
    await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.textContent.trim()==='Print / PDF'&&!button.disabled));
    assert.equal(data.giving.filter(row=>row.donor_name==='Synthetic giving donor').length,1);
    await checkClipboard(page,page.getByRole('button',{name:'Copy',exact:true}));
    assert.deepEqual(durability.errors,[]);
  }finally{await durability.context.close();}
  const noCash=await setup(false);
  try{
    await noCash.page.getByRole('button',{name:/Sunday Cash Counter/}).click();
    assert.equal(await noCash.page.getByLabel('Cash holding account',{exact:true}).inputValue(),'');
    assert.equal(await noCash.page.getByRole('button',{name:'Post Cash to Treasury',exact:true}).isDisabled(),true);
    assert.equal(noCash.requests.length,0);
    await noCash.page.getByRole('button',{name:'Add cash account',exact:true}).click();
    assert.equal(await noCash.page.getByLabel('Account Type',{exact:true}).inputValue(),'cash_petty');
    assert.equal(noCash.requests.length,0,'Opening the account form must not create money or an account.');
  }finally{await noCash.context.close();}
  const {context,page,data,requests,actions,errors,setReject}=await setup();
  try{
    assert.equal(await page.getByRole('button',{name:/Start Afresh|Delete Transaction/}).count(),0);
    await page.getByText('Church Income',{exact:true}).locator('..').locator('..').getByText(/3\.00/).waitFor();
    await page.getByRole('button',{name:/Income & Expense Ledger/}).click();
    const csv=(await download(page,'Export CSV')).toString('utf8');
    assert.ok(csv.length>500);assert.match(csv,/Voucher \/ Ref #/);assert.match(csv,/REF#1/);assert.match(csv,/"'=1\+1"/);assert.match(csv,/"Vendor ""North"", A"/);
    assert.match(csv,/active-expense/);assert.match(csv,/pending-income/);assert.match(csv,/void-expense/);assert.ok(!csv.includes('old-expense'));
    await page.getByRole('button',{name:/^Income \(/}).click();
    const incomeCsv=(await download(page,'Export CSV')).toString('utf8');assert.match(incomeCsv,/pending-income/);assert.ok(!incomeCsv.includes('active-expense'));
    const pdf=await download(page,'Export PDF');assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert.ok(pdf.length>1500);
    await page.getByRole('button',{name:'Request Expenditure',exact:true}).click();
    const expense=modal(page,'Request Church Expenditure');await expense.getByLabel('Expense Purpose / Item Title *',{exact:true}).fill('Overdraft check');await expense.getByLabel('Amount (GH₵) *',{exact:true}).fill('2000');await expense.locator('button[type="submit"]').click();
    await page.getByText('Payment request saved',{exact:true}).waitFor();await page.getByText('Synthetic finance cloud unavailable',{exact:true}).first().waitFor();
    assert.equal(data.church_accounts[0].current_balance,1000.25);
    setReject(false);await retrySyncOrAwait(page);
    const own=page.getByRole('article').filter({has:page.getByRole('heading',{name:'Overdraft check',exact:true})});
    await own.getByText('You requested this payment. Another finance staff member must review it.',{exact:true}).waitFor();assert.equal(await own.getByRole('button',{name:'Approve request',exact:true}).count(),0);
    const review=page.getByRole('article').filter({has:page.getByRole('heading',{name:'Independent request',exact:true})});
    await review.getByRole('button',{name:'Approve request',exact:true}).click();
    let dialog=page.getByRole('dialog');assert.equal(await dialog.getByRole('button',{name:'Approve request',exact:true}).isDisabled(),true);
    await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Approve request',exact:true}).click();await review.getByText('Approved · awaiting payment',{exact:true}).waitFor();
    assert.equal(data.church_accounts[0].current_balance,1000.25);
    await review.getByRole('button',{name:'Record payment as paid',exact:true}).click();dialog=page.getByRole('dialog');
    await dialog.getByLabel('Bank, MoMo or signed cash payment reference',{exact:true}).fill('SYNTHETIC-BANK-20');await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Record payment as paid',exact:true}).click();
    await dialog.getByRole('alert').filter({hasText:'Synthetic interrupted payment confirmation'}).waitFor();assert.equal(data.church_accounts[0].current_balance,980.25);
    await dialog.getByRole('button',{name:'Record payment as paid',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
    assert.equal(data.church_accounts[0].current_balance,980.25);assert.equal(actions.filter(action=>action.p_action==='paid').length,2);assert.deepEqual(actions.at(-1),actions.at(-2));
    await page.getByLabel('Include paid, rejected, cancelled and voided requests',{exact:true}).check();await review.getByText('SYNTHETIC-BANK-20',{exact:true}).waitFor();
    await review.getByRole('button',{name:'View payment voucher',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Copy receipt or voucher',exact:true}).isDisabled(),false);await page.getByRole('button',{name:'Close receipt or voucher',exact:true}).click();
    setReject(true);
    await page.getByRole('button',{name:'Record Income',exact:true}).click();
    const income=modal(page,'Record Church Income');await income.getByLabel('Revenue Title / Purpose *',{exact:true}).fill('Pending browser receipt');await income.getByLabel('Amount (GH₵) *',{exact:true}).fill('12.34');await income.locator('button[type="submit"]').click();
    await page.getByText('Income awaiting confirmation',{exact:true}).waitFor();await page.getByText('Synthetic finance cloud unavailable',{exact:true}).first().waitFor();
    assert.equal(await page.getByRole('button',{name:'Print Receipt',exact:true}).isDisabled(),true);
    assert.equal(await page.getByRole('button',{name:'Copy receipt or voucher',exact:true}).isDisabled(),true);
    await page.getByRole('button',{name:'Close receipt or voucher',exact:true}).click();
    setReject(false);await retrySyncOrAwait(page);
    await page.getByRole('button',{name:/Income & Expense Ledger/}).click();
    await page.getByRole('row').filter({has:page.getByText('Pending browser receipt',{exact:true})}).getByRole('button',{name:'Print Official Church Income Receipt',exact:true}).click();
    await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.textContent.includes('Print Receipt')&&!button.disabled));
    assert.match(data.church_finances.find(row=>row.title==='Pending browser receipt').reference_no,new RegExp(`^INC-${year}-`));
    await checkClipboard(page,page.getByRole('button',{name:'Copy receipt or voucher',exact:true}));
    await page.getByRole('button',{name:'Close receipt or voucher',exact:true}).click();
    await page.getByRole('button',{name:/Sunday Cash Counter/}).click();
    await page.getByLabel('Cash holding account',{exact:true}).selectOption('qa-cash');await page.getByLabel('Counted service',{exact:true}).selectOption('qa-service');
    await page.locator('input[type="number"]').first().fill('1.5');await page.getByRole('button',{name:'Post Cash to Treasury',exact:true}).click();
    await page.getByText('Enter two different counter names and a supervisor name.',{exact:true}).waitFor();
    await page.getByLabel('First counter name',{exact:true}).fill('One Counter');await page.getByLabel('Second counter name',{exact:true}).fill('Two Counter');await page.getByLabel('Cash-count supervisor name',{exact:true}).fill('Supervisor');
    await page.getByRole('button',{name:'Post Cash to Treasury',exact:true}).click();await page.getByText('Enter whole, non-negative quantities for the listed denominations.',{exact:true}).waitFor();
    const cashAcknowledged=page.waitForResponse(response=>response.url().endsWith('/rpc/gwcc_apply_mutations')&&response.request().postDataJSON()?.p_changes.some(change=>change.table==='church_finances'&&change.record?.cash_count_service_id==='qa-service'));
    await page.locator('input[type="number"]').first().fill('1');await page.getByRole('button',{name:'Post Cash to Treasury',exact:true}).click();await cashAcknowledged;await waitForSync(page);
    const counted=data.church_finances.find(row=>row.cash_count_service_id==='qa-service');assert.equal(counted.amount,200);assert.equal(counted.account_id,'qa-cash');assert.equal(counted.cash_count_key,`qa-service:${today}`);assert.equal(counted.cash_count_details.counter1,'One Counter');
    await page.locator('input[type="number"]').first().fill('1');await page.getByRole('button',{name:'Post Cash to Treasury',exact:true}).click();await page.getByText(/A cash count for this service and date is already recorded/).first().waitFor();assert.equal(data.church_finances.filter(row=>row.cash_count_key===counted.cash_count_key).length,1);
    await page.getByRole('button',{name:/Department Budgets/}).click();await page.getByRole('button',{name:'Create Department Budget',exact:true}).click();
    const budgetAcknowledged=page.waitForResponse(response=>response.url().endsWith('/rpc/gwcc_apply_mutations')&&response.request().postDataJSON()?.p_changes.some(change=>change.table==='department_budgets'&&change.record?.period===`${year} Annual`));
    const budget=modal(page,'Add Department Budget');await budget.getByLabel('Department / Ministry Name *',{exact:true}).fill('Facilities');await budget.getByLabel('Budget Allocation (GH₵) *',{exact:true}).fill('1000.25');await budget.getByRole('checkbox',{name:'Block payments that exceed this department budget',exact:true}).check();
    await page.evaluate(()=>{window.__budgetPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,...args){if(this.name==='outboxes'&&value.batches?.length)throw new DOMException('Synthetic budget storage failure','QuotaExceededError');return window.__budgetPut.call(this,value,...args);};});
    await budget.getByRole('button',{name:'Create Budget',exact:true}).click();await page.getByText(/Synthetic budget storage failure/).first().waitFor();assert.equal(await budget.isVisible(),true);assert.equal(await budget.getByLabel('Budget Allocation (GH₵) *',{exact:true}).inputValue(),'1000.25');
    await page.evaluate(()=>{IDBObjectStore.prototype.put=window.__budgetPut;});await budget.getByRole('button',{name:'Create Budget',exact:true}).click();await budgetAcknowledged;await waitForSync(page);
    assert.equal(data.department_budgets.find(row=>row.department==='Facilities').enforce_limit,true);
    await page.getByText('Spent to Date',{exact:true}).locator('..').getByText('GH₵ 100.25',{exact:true}).waitFor();
    await page.getByRole('button',{name:'+ Add / Edit Department Budget',exact:true}).click();await budget.getByLabel('Department / Ministry Name *',{exact:true}).fill('Facilities');await budget.getByLabel('Budget Allocation (GH₵) *',{exact:true}).fill('500');await budget.getByLabel('Budget period',{exact:true}).fill(`Q1-${year}`);await budget.getByRole('button',{name:'Create Budget',exact:true}).click();
    await page.getByText(/This department already has a budget in an overlapping period/).first().waitFor();
    const priorBudgetAcknowledged=page.waitForResponse(response=>response.url().endsWith('/rpc/gwcc_apply_mutations')&&response.request().postDataJSON()?.p_changes.some(change=>change.table==='department_budgets'&&change.record?.period===`${lastYear} Annual`));
    await budget.getByLabel('Budget period',{exact:true}).fill(`${lastYear} Annual`);await budget.getByRole('button',{name:'Create Budget',exact:true}).click();await priorBudgetAcknowledged;await waitForSync(page);await page.getByLabel('Budget year',{exact:true}).selectOption(lastYear);
    await page.getByText('Spent to Date',{exact:true}).locator('..').getByText('GH₵ 40',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Review reconciliation',exact:true}).click();
    await page.getByRole('heading',{name:'Receipts with missing account links',exact:true}).waitFor();await page.getByRole('heading',{name:'Historical repeated references',exact:true}).waitFor();
    const reconciliation=(await download(page,'Export reconciliation CSV')).toString('utf8');assert.match(reconciliation,/Expected recorded balance/);assert.match(reconciliation,/qa-bank/);assert.match(reconciliation,/Review needed/);
    assert.deepEqual(errors,[]);await page.setViewportSize({width:390,height:844});
    await page.waitForFunction(()=>parseFloat(getComputedStyle(document.querySelector('main').parentElement).paddingLeft)===0);
    await page.getByRole('button',{name:'Approvals & Payments',exact:true}).click();
    await page.getByLabel('Include paid, rejected, cancelled and voided requests',{exact:true}).check();
    await own.getByRole('button',{name:'Cancel request',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Reason',{exact:true}).fill('Synthetic request no longer needed');await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Cancel request',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await own.getByText('Cancelled',{exact:true}).waitFor();
    assert.equal(data.church_accounts[0].current_balance,992.59);
    const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,elements:[...document.querySelectorAll('body *')].filter(element=>element.getBoundingClientRect().right>innerWidth+2&&!element.closest('.overflow-x-auto')).slice(0,15).map(element=>({tag:element.tagName,class:element.className,right:Math.round(element.getBoundingClientRect().right),width:Math.round(element.getBoundingClientRect().width),text:element.textContent.slice(0,90)}))}));
    assert.ok(overflow.scroll<=overflow.width+2,`Mobile finance page overflows: ${JSON.stringify(overflow)}`);
    for(const button of await page.getByRole('button',{name:'Dismiss toast',exact:true}).all())await button.click();
    await page.evaluate(()=>window.scrollTo(0,0));
    if(process.env.FINANCE_QA_SCREENSHOT_DIR){await page.screenshot({path:`${process.env.FINANCE_QA_SCREENSHOT_DIR}/finance-approvals-mobile.png`,fullPage:true});await page.setViewportSize({width:1440,height:1000});await page.waitForFunction(()=>parseFloat(getComputedStyle(document.querySelector('main').parentElement).paddingLeft)>0);await page.screenshot({path:`${process.env.FINANCE_QA_SCREENSHOT_DIR}/finance-approvals-desktop.png`,fullPage:true});}
    console.info('Church finance browser checks passed: independent approval, own-request blocking, interrupted payment confirmation with immutable retry, exactly-once posting, authenticated history,  CSV/PDF filters and escaping, exact cents, unposted requests, pending receipt confirmation, explicit cash accounts and witnesses, duplicate counts, historical budget usage, reconciliation and mobile layout.');
  }finally{await context.close();}
}

async function checkClipboard(page,button){
 await page.evaluate(()=>{window.__receiptMode='hold';});await button.click();
 assert.equal(await button.isDisabled(),true);assert.equal(await page.getByText('Copied',{exact:true}).count(),0);
 await page.evaluate(()=>{window.__receiptResolve();});await page.getByText('Copied',{exact:true}).waitFor();
 await page.evaluate(()=>{window.__receiptMode='deny';});await button.click();await page.getByText('Copy failed',{exact:true}).waitFor();
 assert.equal(await page.getByText('Copied',{exact:true}).count(),0);
 await page.evaluate(()=>{window.__receiptMode='ok';});await button.click();await page.getByText('Copied',{exact:true}).waitFor();
}
