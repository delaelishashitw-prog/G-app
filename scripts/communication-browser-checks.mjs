import assert from 'node:assert/strict';
import {watchSyncStatus,waitForSync,readSavedOutbox} from './sync-browser-utils.mjs';

export async function checkCommunication(browser,{origin,settings,sampleMember}){
  const today=new Date().toISOString().slice(0,10),owner='14141414-1414-4414-8414-141414141414';
  const user={id:owner,email:'communication-qa@example.test',email_confirmed_at:today+'T00:00:00Z',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{}};
  const profile={id:owner,email:user.email,first_name:'Synthetic',last_name:'Secretary',role:'super_admin',is_active:true,has_login_account:true,authorization_reviewed_at:today+'T00:00:00Z'};
  const exp=Math.floor(Date.now()/1000)+3600,token=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:owner,role:'authenticated',exp})).toString('base64url')}.test-signature`;
  const session={user,access_token:token,refresh_token:'qa-refresh',expires_at:exp,expires_in:3600,token_type:'bearer'};
  const member=(id,extra={})=>({...sampleMember,id,member_id:'SYNTHETIC-'+id,first_name:'Synthetic',last_name:id,phone:'0240000001',status:'active',is_archived:false,ministry_id:'ministry-a',small_group_id:'group-a',leadership_position:'',...extra});
  const fixture={profiles:[profile],settings:[{id:'gwcc_global_settings',...settings}],members:[member('a'),member('b',{phone:'+233240000001'}),member('c',{is_archived:true,phone:'0240000002'}),member('d',{status:'inactive',phone:'0240000003'}),member('e',{phone:'23324000001'}),member('f',{status:'leader',phone:'0240000004'})],ministries:[{id:'ministry-a',name:'Synthetic Ministry A',leader_name:'Synthetic Leader',meeting_day:'Saturday',meeting_time:'16:00',is_active:true}],small_groups:[{id:'group-a',name:'Synthetic Group A',meeting_location:'Synthetic hall',meeting_day:'Wednesday',meeting_time:'18:00'}],communications:[{id:'legacy-message',title:'Legacy audience',message:'Old synthetic draft',sender_id:'GWCC',channel:'sms',recipient_type:'custom',recipient_count:10,status:'draft',sent_at:today+'T00:00:00Z'}]};
  async function setup(role='super_admin'){
    const data=structuredClone(fixture);data.profiles[0].role=role;
    const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    await context.grantPermissions(['clipboard-read','clipboard-write'],{origin});await context.addInitScript(watchSyncStatus);
    await context.addInitScript(({session})=>{localStorage.setItem('gwcc_supabase_url','https://gwcc-e2e.supabase.co');localStorage.setItem('gwcc_supabase_anon_key','test-public-key');localStorage.setItem('gwcc-church-auth-token',JSON.stringify(session));window.__openedLinks=[];window.open=url=>{window.__openedLinks.push(url);return null;};},{session});
    let rejectWrites=true;const requests=[],reads=[];
    await context.route('https://gwcc-e2e.supabase.co/**',async route=>{
      const request=route.request(),url=new URL(request.url()),headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','content-type':'application/json'};
      if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
      let result=[];
      if(url.pathname==='/auth/v1/user')result=user;
      else if(url.pathname==='/auth/v1/token')result=session;
      else if(url.pathname==='/rest/v1/rpc/gwcc_apply_mutations'){
        assert.equal(request.headers().authorization,`Bearer ${token}`);const body=request.postDataJSON();requests.push(body);
        if(rejectWrites){await route.fulfill({status:503,headers,body:JSON.stringify({message:'Synthetic communication cloud unavailable'})});return;}
        result=body.p_changes.filter(change=>change.table!=='audit_logs').map(change=>{
          const previous=data[change.table]?.find(row=>row.id===change.id),now=new Date().toISOString();
          const record={...change.record,updated_at:now};
          if(change.table==='communications')Object.assign(record,{status:'draft',created_by:previous?.created_by||owner,updated_by:owner,created_at:previous?.created_at||previous?.sent_at||now,sent_at:previous?.sent_at||now});
          return {table:change.table,record};
        });
        for(const row of result){data[row.table]??=[];data[row.table]=[row.record,...data[row.table].filter(old=>old.id!==row.record.id)];}
      }else if(url.pathname.startsWith('/rest/v1/')){
        const table=url.pathname.split('/').at(-1);reads.push(table);const rows=data[table]||[],offset=Number(url.searchParams.get('offset')||0);result=rows.slice(offset,offset+Number(url.searchParams.get('limit')||500));if(request.headers().accept?.includes('vnd.pgrst.object'))result=result[0]||null;
      }
      await route.fulfill({status:200,headers,body:JSON.stringify(result)});
    });
    const page=await context.newPage(),errors=[];page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin+'/communication');await page.getByRole('heading',{name:role==='super_admin'?'Communication':'Access Restricted',exact:true}).waitFor();
    return {context,page,data,requests,reads,errors,setReject:value=>{rejectWrites=value;}};
  }
  const {context,page,data,requests,errors,setReject}=await setup();
  const saved=title=>page.getByRole('article',{name:'Saved message: '+title,exact:true});
  try{
    await page.getByText('2 unique valid phone numbers · 4 excluded records.',{exact:true}).waitFor();
    await page.getByLabel('Recipients',{exact:true}).selectOption('leaders');await page.getByText('1 unique valid phone numbers · 0 excluded records.',{exact:true}).waitFor();
    await page.getByLabel('Recipients',{exact:true}).selectOption('ministry');await page.getByLabel('Choose group',{exact:true}).selectOption('ministry-a');
    await page.getByLabel('Title',{exact:true}).fill('Synthetic ministry draft');await page.getByLabel('Message',{exact:true}).fill('First synthetic message');await page.getByRole('button',{name:'Save draft',exact:true}).click();
    await page.getByText('Draft saved on this device',{exact:true}).first().waitFor();await page.getByText('Synthetic communication cloud unavailable',{exact:true}).first().waitFor();
    const pending=await readSavedOutbox(page,owner),change=pending.batches.flatMap(batch=>batch.changes).find(change=>change.table==='communications'),record=change.record;
    assert.deepEqual(record.recipient_ids,['a','f']);assert.equal(record.recipient_group_id,'ministry-a');assert.equal(record.recipient_group_name,'Synthetic Ministry A');assert.equal(record.created_by,owner);
    await saved(record.title).getByText('Awaiting cloud confirmation',{exact:true}).waitFor();
    await page.reload();await saved(record.title).getByRole('button',{name:'Edit draft',exact:true}).click();
    assert.equal(await page.getByLabel('Recipients',{exact:true}).inputValue(),'ministry');assert.equal(await page.getByLabel('Choose group',{exact:true}).inputValue(),'ministry-a');assert.equal(await page.getByLabel('Message',{exact:true}).inputValue(),record.message);
    await page.getByLabel('Message',{exact:true}).fill('Edited while cloud unavailable');await page.getByRole('button',{name:'Save changes',exact:true}).click();
    await page.getByText('Draft saved on this device',{exact:true}).first().waitFor();
    const editedPending=await readSavedOutbox(page,owner);assert.ok(editedPending.batches.some(batch=>batch.id===pending.batches.find(batch=>batch.changes.some(row=>row.id===record.id)).id));assert.equal(new Set(editedPending.batches.flatMap(batch=>batch.changes).filter(row=>row.table==='communications').map(row=>row.id)).size,1);
    setReject(false);await page.getByRole('button',{name:'Retry sync',exact:true}).click();await waitForSync(page);
    assert.equal(data.communications.filter(row=>row.id===record.id).length,1);assert.equal(data.communications.find(row=>row.id===record.id).message,'Edited while cloud unavailable');
    await saved(record.title).getByText('Draft · cloud confirmed',{exact:true}).waitFor();
    await page.getByLabel('Message',{exact:true}).fill('Cloud edit');await page.getByRole('button',{name:'Save changes',exact:true}).click();await saved(record.title).getByText('Awaiting cloud confirmation',{exact:true}).waitFor();await saved(record.title).getByText('Draft · cloud confirmed',{exact:true}).waitFor();await waitForSync(page);
    assert.equal(data.communications.filter(row=>row.id===record.id).length,1);assert.equal(data.communications.find(row=>row.id===record.id).message,'Cloud edit');
    await saved(record.title).getByRole('button',{name:'Copy message',exact:true}).click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'Cloud edit');
    await saved(record.title).getByRole('button',{name:'Copy as new draft',exact:true}).click();await page.getByLabel('Title',{exact:true}).fill('Copied draft');await page.getByRole('button',{name:'Save draft',exact:true}).click();await saved('Copied draft').getByText('Draft · cloud confirmed',{exact:true}).waitFor();await waitForSync(page);
    assert.equal(data.communications.length,3);assert.notEqual(data.communications.find(row=>row.title==='Copied draft').id,record.id);
    await saved('Copied draft').getByRole('button',{name:'Archive draft',exact:true}).click();await saved('Copied draft').getByRole('button',{name:'Confirm archive',exact:true}).click();await page.getByText('Draft archive awaiting confirmation',{exact:true}).first().waitFor();await waitForSync(page);assert.ok(data.communications.find(row=>row.title==='Copied draft').archived_at);
    await page.getByLabel('Show archived drafts',{exact:true}).check();await saved('Copied draft').getByRole('button',{name:'Restore draft',exact:true}).click();await page.getByText('Draft restore awaiting confirmation',{exact:true}).first().waitFor();await waitForSync(page);await page.getByLabel('Show archived drafts',{exact:true}).uncheck();await saved('Copied draft').waitFor();
    await saved('Legacy audience').getByRole('button',{name:'Edit draft',exact:true}).click();await page.getByText('This older draft has no saved recipient list. Review the audience and phone numbers before saving.',{exact:true}).waitFor();assert.equal(await page.getByLabel('Recipients',{exact:true}).inputValue(),'');
    await page.getByRole('button',{name:'New draft',exact:true}).click();await page.getByLabel('Message',{exact:true}).fill('WhatsApp synthetic preview');
    await page.getByLabel('Phone number',{exact:true}).fill('00233240000001');await page.getByRole('button',{name:'Open WhatsApp draft',exact:true}).click();assert.match((await page.evaluate(()=>window.__openedLinks))[0],/^https:\/\/wa.me\/233240000001\?text=/);
    for(const number of ['+2330240000001','letters+233240000001']){await page.getByLabel('Phone number',{exact:true}).fill(number);await page.getByRole('button',{name:'Open WhatsApp draft',exact:true}).click();}
    assert.equal((await page.evaluate(()=>window.__openedLinks)).length,1);assert.equal(await page.getByLabel('Title',{exact:true}).getAttribute('maxlength'),'200');
    await page.getByLabel('Title',{exact:true}).fill('X'.repeat(200));await page.getByLabel('Message',{exact:true}).fill('https://example.test/'+ 'x'.repeat(300));await page.getByRole('button',{name:'Save draft',exact:true}).click();await saved('X'.repeat(200)).getByText('Draft · cloud confirmed',{exact:true}).waitFor();await waitForSync(page);
    await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>parseFloat(getComputedStyle(document.querySelector('main').parentElement).paddingLeft)===0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Communication overflows on mobile.');
    assert.deepEqual(errors,[]);assert.ok(requests.length>0);
    await page.setViewportSize({width:1440,height:1000});await page.goto(origin+'/ministries');await page.getByText('Synthetic Ministry A',{exact:true}).first().waitFor();
    await page.getByRole('button',{name:'Announcement drafts',exact:true}).click();await page.getByLabel('Ministry announcement message',{exact:true}).fill('Synthetic ministry announcement');await page.getByRole('button',{name:'Save announcement draft',exact:true}).click();await page.getByText('Announcement draft saved',{exact:true}).waitFor();await waitForSync(page);
    const ministryDraft=data.communications.find(row=>row.message==='Synthetic ministry announcement');assert.equal(ministryDraft.status,'draft');assert.equal(ministryDraft.recipient_group_id,'ministry-a');assert.equal(ministryDraft.recipient_count,2);assert.equal(await page.getByText('Announcement Dispatched',{exact:true}).count(),0);
  }finally{await context.close();}
  const denied=await setup('attendance_officer');try{assert.equal(denied.reads.includes('communications'),false);assert.equal(await denied.page.getByText('Old synthetic draft',{exact:true}).count(),0);}finally{await denied.context.close();}
  console.info('Communication browser checks passed: unique eligible audiences, durable draft edits/retry, group metadata, cloud status, copy/archive/restore, legacy review, WhatsApp validation, mobile wrapping, ministry draft truthfulness and denied-role cache/API guards.');
}
