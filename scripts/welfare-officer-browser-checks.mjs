import assert from 'node:assert/strict';
import {watchSyncStatus,waitForSync} from './sync-browser-utils.mjs';

// Synthetic identities and isolated HTTP fixtures: no live account or email.
export async function checkWelfareOfficer(browser,{origin,settings,sampleMember}) {
  for(const width of [390,1440]) {
    const id='73737373-7373-4373-8373-737373737373',role='welfare_officer',now=new Date().toISOString();
    const profile={id,role,email:'welfare@example.test',first_name:'Synthetic',last_name:'Officer',is_active:true,has_login_account:true,authorization_reviewed_at:now};
    const user={id,email:profile.email,email_confirmed_at:now,aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{}};
    const exp=Math.floor(Date.now()/1000)+3600;
    const access_token=`${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({sub:id,role:'authenticated',aal:'aal2',session_id:id,exp})).toString('base64url')}.synthetic-signature`;
    const session={user,access_token,refresh_token:'synthetic-welfare-role',expires_at:exp,expires_in:3600,token_type:'bearer'};
    const m={...sampleMember,id:'officer-beneficiary',first_name:'Synthetic',last_name:'Beneficiary',member_id:'GWCC-OFFICER',is_archived:false,status:'active',auth_user_id:null};
    const claim={id:'officer-review',claim_number:'BEN-OFFICER',beneficiary_type:'church_member',member_id:m.id,member_name:'Synthetic Beneficiary',title:'Synthetic relief review',description:'Synthetic welfare request',category:'emergency_relief',amount_requested:100,status:'pending',emergency_level:'normal',date_submitted:now.slice(0,10),created_at:now,updated_at:now};
    const data={members:[m],profiles:[profile],settings:[{id:'gwcc_global_settings',...settings}],welfare_contributions:[],welfare_claims:[claim],welfare_events:[],welfare_event_contributions:[]};
    const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'}),requests=[],errors=[];
    await context.addInitScript(watchSyncStatus);
    await context.addInitScript(({session})=>{localStorage.setItem('gwcc_supabase_url','https://gwcc-e2e.supabase.co');localStorage.setItem('gwcc_supabase_anon_key','synthetic-public-key');localStorage.setItem('gwcc-church-auth-token',JSON.stringify(session));},{session});
    await context.route('https://gwcc-e2e.supabase.co/**',async route=>{
      const request=route.request(),url=new URL(request.url()),headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','content-type':'application/json'};
      if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
      let result=[];
      if(url.pathname==='/auth/v1/user')result=user;
      else if(url.pathname==='/auth/v1/token')result=session;
      else if(url.pathname==='/rest/v1/rpc/gwcc_security_status')result={role,required:true,verified_factors:1,satisfied:true};
      else if(url.pathname==='/rest/v1/profiles')result=request.headers().accept?.includes('vnd.pgrst.object')?profile:[profile];
      else if(url.pathname==='/rest/v1/rpc/gwcc_apply_mutations'){
        const body=request.postDataJSON();requests.push(body);
        result=body.p_changes.filter(c=>c.table!=='audit_logs').map(c=>{
          assert.ok(['welfare_contributions','welfare_claims','welfare_events','welfare_event_contributions'].includes(c.table));assert.equal(c.operation,'upsert');
          const record={...c.record,recorded_by:'Synthetic Officer',...(c.table==='welfare_claims'?{reviewed_by:'Synthetic Officer'}:{}),updated_at:new Date().toISOString()};
          data[c.table]=[record,...(data[c.table]||[]).filter(row=>row.id!==c.id)];return {table:c.table,record};
        });
      }else if(url.pathname.startsWith('/rest/v1/')){const rows=data[url.pathname.split('/').at(-1)]||[];result=rows.slice(Number(url.searchParams.get('offset')||0),Number(url.searchParams.get('offset')||0)+Number(url.searchParams.get('limit')||500));}
      await route.fulfill({status:200,headers,json:result});
    });
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    try {
      await page.goto(origin+'/');await page.waitForURL('**/welfare');
      await page.getByRole('button',{name:'Record Welfare Dues',exact:true}).waitFor();
      assert.equal(await page.getByRole('button',{name:'Add to Fund',exact:true}).count(),0);
      for(const href of ['/church-finance','/users','/pastoral-care','/members','/assistant'])assert.equal(await page.locator(`a[href="${href}"]`).count(),0,href);
      await page.getByRole('button',{name:'Record Welfare Dues',exact:true}).click();
      const dues=page.getByRole('dialog',{name:'Record Welfare Dues'});
      await dues.locator('select').first().selectOption(m.id);
      await dues.locator('input[type="number"]').fill('20');
      await Promise.all([page.waitForResponse(response=>response.url().endsWith('/rest/v1/rpc/gwcc_apply_mutations')&&response.request().postDataJSON()?.p_changes?.some(c=>c.table==='welfare_contributions')),dues.getByRole('button',{name:'Save Contribution',exact:true}).click()]);
      await waitForSync(page);
      assert.equal(data.welfare_contributions.length,1);assert.equal(data.welfare_contributions[0].amount,20);
      await page.getByRole('button',{name:/Benevolence Aid Claims/}).click();
      await page.getByRole('row').filter({has:page.getByText('BEN-OFFICER',{exact:true})}).getByRole('button',{name:'Review',exact:true}).click();
      const review=page.getByRole('dialog',{name:'Review Benevolence Claim'});
      assert.equal(await review.getByLabel('Evaluation decision').locator('option[value="disbursed"]').isDisabled(),true);
      await review.getByLabel('Evaluation decision').selectOption('approved');
      await review.getByLabel('Approved aid (GHS)').fill('50');
      await Promise.all([page.waitForResponse(response=>response.url().endsWith('/rest/v1/rpc/gwcc_apply_mutations')&&response.request().postDataJSON()?.p_changes?.some(c=>c.table==='welfare_claims')),review.getByRole('button',{name:'Save Review',exact:true}).click()]);await waitForSync(page);
      assert.equal(data.welfare_claims[0].amount_approved,50);assert.equal(data.welfare_claims[0].reviewed_by,'Synthetic Officer');
      await page.getByRole('row').filter({has:page.getByText('BEN-OFFICER',{exact:true})}).getByRole('button',{name:'Review',exact:true}).click();
      assert.equal(await review.getByRole('button',{name:'Generate Payment Voucher',exact:true}).count(),0);
      await review.getByRole('button',{name:'Close welfare claim review',exact:true}).click();
      await page.getByRole('button',{name:/Event Contributions/}).click();
      await page.getByRole('button',{name:'New Event Appeal',exact:true}).click();
      const appeal=page.getByRole('heading',{name:'Create Welfare Event Appeal',exact:true}).locator('xpath=ancestor::div[contains(@class,"fixed")][1]');
      const levy=appeal.getByLabel('Minimum appeal levy (GHS)');
      assert.equal(await levy.inputValue(),'10.00');assert.equal(await levy.getAttribute('min'),'10');
      await appeal.getByPlaceholder('e.g. Late Deacon Solomon Ofori - Funeral Benevolence Fund').fill('Synthetic GHc10 appeal');
      await appeal.getByPlaceholder('Provide a clear, respectful summary for the congregation detailing the need, burial plans, or recovery aid...').fill('Synthetic appeal for the minimum levy check.');
      await levy.fill('9.99');
      await appeal.getByRole('button',{name:'Create & Publish Appeal',exact:true}).click();
      assert.equal(await levy.evaluate(el=>el.checkValidity()),false);assert.equal(data.welfare_events.length,0);
      await levy.fill('10.00');
      await Promise.all([page.waitForResponse(response=>response.url().endsWith('/rest/v1/rpc/gwcc_apply_mutations')&&response.request().postDataJSON()?.p_changes?.some(c=>c.table==='welfare_events')),appeal.getByRole('button',{name:'Create & Publish Appeal',exact:true}).click()]);
      await waitForSync(page);assert.equal(data.welfare_events[0].minimum_contribution,10);
      await page.getByRole('button',{name:'Record Contribution',exact:true}).click();
      const contribution=page.getByRole('heading',{name:'Record Welfare Contribution',exact:true}).locator('xpath=ancestor::div[contains(@class,"fixed")][1]');
      const amount=contribution.getByLabel('Appeal contribution amount (GHS)');
      assert.equal(await amount.getAttribute('min'),'10');
      await amount.fill('9.99');assert.equal(await contribution.getByRole('button',{name:'Confirm & Post Contribution',exact:true}).isDisabled(),true);
      await amount.fill('10.00');
      await Promise.all([page.waitForResponse(response=>response.url().endsWith('/rest/v1/rpc/gwcc_apply_mutations')&&response.request().postDataJSON()?.p_changes?.some(c=>c.table==='welfare_event_contributions')),contribution.getByRole('button',{name:'Confirm & Post Contribution',exact:true}).click()]);
      await waitForSync(page);assert.equal(data.welfare_event_contributions[0].amount,10);assert.equal(data.welfare_contributions[0].amount,20);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Welfare officer mobile overflow');
      for(const path of ['/church-finance','/users','/pastoral-care','/members','/assistant']){
        await page.goto(origin+path);await page.getByRole('heading',{name:'Access Restricted',exact:true}).waitFor();
      }
      assert.equal(errors.length,0,errors.join(' | '));assert.ok(requests.length>=2);
    }catch(error){console.log('Welfare officer requests:',JSON.stringify(requests));console.log('Welfare officer failure:',(await page.locator('body').innerText()).slice(-4500));throw error;}finally{await context.close();}
  }
  console.log('Welfare officer browser checks passed: GHc10 appeals and exact receipts, minimum rejection, dedicated landing, dues recording, relief review, finance separation, direct-route denial and mobile/desktop layout.');
}
