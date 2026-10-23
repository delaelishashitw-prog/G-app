import assert from 'node:assert/strict';
import {watchSyncStatus,waitForSync,readSavedOutbox} from './sync-browser-utils.mjs';

export async function checkWelfareFunds(browser,{origin,settings,sampleMember}) {
  const actor='41414141-4141-4141-8141-414141414141';
  const now=new Date().toISOString(),today=now.slice(0,10);
  async function setup(role='super_admin',width=1440) {
    const profile={id:actor,email:'funds@example.test',first_name:'Synthetic',last_name:'Finance',role,is_active:true,has_login_account:true,authorization_reviewed_at:now};
    const user={id:actor,email:profile.email,email_confirmed_at:now,role:'authenticated',aud:'authenticated',app_metadata:{provider:'email'},user_metadata:{}};
    const exp=Math.floor(Date.now()/1000)+3600,token=`${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:actor,role:'authenticated',aal:'aal2',session_id:actor,exp})).toString('base64url')}.synthetic-signature`;
    const session={user,access_token:token,refresh_token:'synthetic-welfare-refresh',expires_at:exp,expires_in:3600,token_type:'bearer'};
    const data={settings:[{id:'gwcc_global_settings',...settings}],members:[{...sampleMember,id:'fund-member',member_id:'GWCC-FUND',first_name:'Synthetic',last_name:'Member',auth_user_id:null,is_archived:false,status:'active'}],welfare_contributions:[{id:'named-dues',member_id:'fund-member',member_name:'Synthetic Member',date:'2026-04-10',month:'2026-04',amount:100,payment_method:'cash',recorded_by:'Synthetic',created_at:now}],welfare_claims:[],gwcc_documents:[]};
    const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[],requests=[],receipts=new Map();
    let rejectWrites=true,loseConfirmation=false,revision=0;
    await context.addInitScript(watchSyncStatus);
    await context.addInitScript(({session})=>{
      localStorage.setItem('gwcc_supabase_url','https://gwcc-e2e.supabase.co');localStorage.setItem('gwcc_supabase_anon_key','synthetic-public-key');localStorage.setItem('gwcc-church-auth-token',JSON.stringify(session));
      const original=IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put=function(...args){if(window.__FAIL_FUND_STORAGE__&&this.name==='outboxes')throw new DOMException('Synthetic device storage full','QuotaExceededError');return original.apply(this,args);};
    },{session});
    await context.route('https://gwcc-e2e.supabase.co/**',async route=>{
      const request=route.request(),url=new URL(request.url()),headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','content-type':'application/json'};
      if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
      const fail=message=>route.fulfill({status:503,headers,body:JSON.stringify({message})});let result=[];
      if(url.pathname==='/auth/v1/user')result=user;
      else if(url.pathname==='/auth/v1/token')result=session;
      else if(url.pathname==='/rest/v1/rpc/gwcc_security_status')result={role,required:true,verified_factors:1,satisfied:true};
      else if(url.pathname==='/rest/v1/profiles')result=request.headers().accept?.includes('vnd.pgrst.object')?profile:[profile];
      else if(url.pathname==='/rest/v1/rpc/gwcc_apply_mutations'){
        const body=request.postDataJSON();requests.push(body);
        if(rejectWrites){await fail('Synthetic welfare cloud unavailable; pending receipt retained.');return;}
        const previous=receipts.get(body.p_operation_id);
        if(previous){assert.deepEqual(body,previous.body);result=previous.result;}
        else{
          result=body.p_changes.filter(change=>change.table!=='audit_logs').map(change=>{
            assert.equal(change.table,'welfare_fund_receipts');assert.equal(change.operation,'upsert');
            assert.equal(change.record.member_id,undefined);assert.equal(change.record.member_name,undefined);
            const old=data.gwcc_documents.find(row=>row.namespace===change.table&&row.id===change.id)?.data;
            if(old)assert.equal(change.expected_updated_at,old.updated_at);
            const record={...change.record,recorded_by_id:old?.recorded_by_id||actor,recorded_by:old?.recorded_by||'Synthetic Finance',created_at:old?.created_at||now,updated_at:new Date(Date.now()+ ++revision).toISOString(),...(change.record.status==='voided'?{voided_by_id:actor,voided_by:'Synthetic Finance',voided_at:new Date().toISOString()}: {})};
            data.gwcc_documents=[{namespace:change.table,id:change.id,data:record},...data.gwcc_documents.filter(row=>row.namespace!==change.table||row.id!==change.id)];
            return {table:change.table,canonical_table:change.table,record};
          });
          receipts.set(body.p_operation_id,{body:structuredClone(body),result:structuredClone(result)});
          if(loseConfirmation){loseConfirmation=false;await fail('Synthetic receipt committed but confirmation was interrupted.');return;}
        }
      }else if(url.pathname.startsWith('/rest/v1/')){
        let rows=data[url.pathname.split('/').at(-1)]||[];
        if(url.searchParams.has('namespace'))rows=rows.filter(row=>row.namespace===url.searchParams.get('namespace').replace(/^eq\./,''));
        const offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||500);
        result=rows.slice(offset,offset+limit);
      }
      await route.fulfill({status:200,headers,body:JSON.stringify(result)});
    });
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    const balance=()=>page.getByText('Welfare Fund Balance',{exact:true}).locator('..').locator('..');
    await page.goto(origin+'/welfare');await balance().getByText('GH₵ 100.00',{exact:true}).waitFor();
    return {context,page,data,errors,requests,receipts,balance,setReject:value=>{rejectWrites=value;},loseNext:()=>{loseConfirmation=true;}};
  }
  const app=await setup();
  try {
    const {page,balance}=app;
    await page.getByRole('button',{name:'Add to Fund',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Add Welfare Funds'});
    assert.equal(await dialog.getByLabel('Member',{exact:true}).count(),0);
    await dialog.getByLabel('Amount (GH₵)',{exact:true}).fill('200.25');
    await dialog.getByLabel('Source',{exact:true}).selectOption('opening_balance');
    await dialog.getByLabel('Reference',{exact:true}).fill('WFR-SYNTHETIC');
    await dialog.getByLabel('Source note',{exact:true}).fill('Previous welfare funds brought forward from the ledger');
    assert.deepEqual(await dialog.locator('input,select,textarea').evaluateAll(nodes=>nodes.filter(node=>!node.validity.valid).map(node=>({type:node.type,value:node.value,error:node.validationMessage}))),[], 'Fund form must be valid before submitting');
    await dialog.getByRole('form',{name:'Add welfare funds'}).evaluate(form=>{form.requestSubmit();form.requestSubmit();});
    const row=()=>page.getByRole('row').filter({has:page.getByText('WFR-SYNTHETIC',{exact:true})});
    await row().getByText('Awaiting cloud confirmation',{exact:true}).first().waitFor();
    await page.getByText('Synthetic welfare cloud unavailable; pending receipt retained.',{exact:true}).waitFor();
    await balance().getByText('GH₵ 100.00',{exact:true}).waitFor();
    assert.equal(await row().count(),1);
    const first=app.requests[0],snapshot=await readSavedOutbox(page,actor);
    assert.equal(snapshot.batches.flatMap(batch=>batch.changes).filter(change=>change.table==='welfare_fund_receipts').length,1);
    await page.reload();await page.getByRole('button',{name:'Fund Receipts',exact:true}).click();
    await row().getByText('Awaiting cloud confirmation',{exact:true}).first().waitFor();
    await page.getByText('Synthetic welfare cloud unavailable; pending receipt retained.',{exact:true}).waitFor();
    assert.deepEqual(app.requests.at(-1),first);
    app.setReject(false);app.loseNext();await page.getByRole('button',{name:'Retry sync',exact:true}).click();
    await page.getByText('Synthetic receipt committed but confirmation was interrupted.',{exact:true}).waitFor();
    await balance().getByText('GH₵ 100.00',{exact:true}).waitFor();
    assert.equal(app.data.gwcc_documents.length,1);
    await page.getByRole('button',{name:'Retry sync',exact:true}).click();await waitForSync(page);
    await row().getByText('Confirmed',{exact:true}).waitFor();await balance().getByText('GH₵ 300.25',{exact:true}).waitFor();
    assert.equal(app.data.welfare_contributions.length,1);assert.equal(app.data.welfare_contributions[0].amount,100);
    assert.equal(app.receipts.size,1);assert.deepEqual(app.requests.at(-1),first);
    await page.getByRole('button',{name:'Audit Report',exact:true}).click();
    const audit=page.getByRole('dialog',{name:'GWCC Welfare & Benevolence Mutual Fund Statement'});
    await audit.getByText('Additional Fund Receipts · GH₵ 200.25',{exact:true}).waitFor();
    await audit.getByText('WFR-SYNTHETIC',{exact:true}).waitFor();
    await audit.getByRole('button',{name:'Close welfare audit report'}).click();
    await page.getByRole('button',{name:'Member Standing & Balances',exact:true}).click();
    const memberRow=page.getByRole('row').filter({has:page.getByText('Synthetic Member',{exact:true})});
    await memberRow.getByText('Welfare joining date: 2026-04-10 (first dues payment)',{exact:true}).waitFor();
    await memberRow.getByText('Defaulter — Partially eligible',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Fund Receipts',exact:true}).click();
    await row().getByRole('button',{name:'Void receipt WFR-SYNTHETIC',exact:true}).click();
    const voidDialog=page.getByRole('dialog',{name:'Void Welfare Fund Receipt'});
    await voidDialog.getByLabel('Reason for voiding',{exact:true}).fill('Synthetic duplicate identified during review');
    app.setReject(true);await voidDialog.getByRole('button',{name:'Confirm void receipt',exact:true}).click();
    await row().getByText('Void awaiting confirmation',{exact:true}).waitFor();
    await page.getByText('Synthetic welfare cloud unavailable; pending receipt retained.',{exact:true}).waitFor();
    await balance().getByText('GH₵ 300.25',{exact:true}).waitFor();
    const voidRequest=app.requests.at(-1);assert.equal(voidRequest.p_changes[0].record.status,'voided');
    await page.reload();await page.getByRole('button',{name:'Fund Receipts',exact:true}).click();
    await row().getByText('Void awaiting confirmation',{exact:true}).waitFor();await balance().getByText('GH₵ 300.25',{exact:true}).waitFor();
    app.setReject(false);await page.getByRole('button',{name:'Retry sync',exact:true}).click();await waitForSync(page);
    await row().getByText('Voided',{exact:true}).waitFor();await balance().getByText('GH₵ 100.00',{exact:true}).waitFor();
    assert.equal(app.data.gwcc_documents.length,1);assert.equal(app.receipts.size,2);assert.deepEqual(app.requests.at(-1),voidRequest);
    await page.setViewportSize({width:390,height:844});
    await page.getByRole('button',{name:'Add to Fund',exact:true}).click();
    await dialog.getByLabel('Amount (GH₵)',{exact:true}).fill('10');
    await dialog.getByLabel('Source',{exact:true}).selectOption('unallocated_dues');
    await dialog.getByLabel('Reference',{exact:true}).fill('WFR-DEVICE-RETRY');
    await dialog.getByLabel('Source note',{exact:true}).fill('Dues received without individual member breakdown');
    await page.evaluate(()=>{window.__FAIL_FUND_STORAGE__=true;});
    await dialog.getByRole('button',{name:'Save fund receipt',exact:true}).click();
    await dialog.getByRole('alert').getByText(/Device storage could not preserve this change/).waitFor();
    assert.equal(await dialog.getByLabel('Amount (GH₵)',{exact:true}).isDisabled(),true);
    assert.equal(await dialog.getByLabel('Amount (GH₵)',{exact:true}).inputValue(),'10');
    await balance().getByText('GH₵ 100.00',{exact:true}).waitFor();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Welfare mobile overflow');
    await page.screenshot({path:'/tmp/gwcc-welfare-funds-mobile.png',fullPage:true});
    await page.evaluate(()=>{window.__FAIL_FUND_STORAGE__=false;});
    await dialog.getByRole('button',{name:'Retry same receipt',exact:true}).click();await waitForSync(page);
    await balance().getByText('GH₵ 110.00',{exact:true}).waitFor();
    assert.equal(app.data.gwcc_documents.length,2);assert.equal(app.data.gwcc_documents.filter(row=>row.data.reference_no==='WFR-DEVICE-RETRY').length,1);
    assert.equal(app.errors.length,0,app.errors.join(' | '));
  }catch(error){console.log('Welfare failure state:',(await app.page.locator('body').innerText()).slice(-6500));console.log('Welfare page errors:',app.errors,'mutation count:',app.requests.length);await app.page.screenshot({path:'/tmp/gwcc-welfare-funds-failure.png',fullPage:true});throw error;}finally{await app.context.close();}
  for(const role of ['administrator','pastor','finance_officer']) {
    const app=await setup(role,390);
    try {
      assert.equal(await app.page.getByRole('button',{name:'Add to Fund',exact:true}).count(),role==='finance_officer'?1:0);
      await app.page.getByRole('button',{name:'Fund Receipts',exact:true}).click();
      assert.equal(await app.page.getByRole('button',{name:/^Void receipt/}).count(),0);
      assert.ok(await app.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
      assert.equal(app.errors.length,0,app.errors.join(' | '));
    }finally{await app.context.close();}
  }
  console.log('Welfare funds browser checks passed: unnamed receipts, exact-once retry after reload/lost confirmation, member standing unchanged, audited totals, preserved void history, pending balance semantics, device-storage retry and mobile/role controls.');
}
