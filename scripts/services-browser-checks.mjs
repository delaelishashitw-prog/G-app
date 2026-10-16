import assert from 'node:assert/strict';
import {waitForSync} from './sync-browser-utils.mjs';

export function serviceFixtures(now) {
  const clock=new Date(now);clock.setUTCSeconds(0,0);
  const start=new Date(clock.getTime()+60000),end=new Date(start.getTime()+3600000);
  const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const time=date=>date.toISOString().slice(11,16),date=clock.toISOString().slice(0,10);
  const a={id:'qa-service-a',name:'QA Main Service',type:'sunday',day_of_week:days[start.getUTCDay()],start_time:time(start),end_time:time(end),is_active:true,expected_attendance:100,order_of_service:[{id:'qa-order',order:1,title:'QA Prayer',duration:'1 hour 30 minutes'}]};
  const later=new Date(start.getTime()+7200000);
  const b={...a,id:'qa-service-b',name:'QA Main Service Evening',day_of_week:days[later.getUTCDay()],start_time:time(later),end_time:time(new Date(later.getTime()+3600000))};
  const attendance=[
    {id:'qa-att-1',service_id:a.id,service_name:a.name,date,member_id:'qa-member',member_name:'QA Member',status:'present'},
    {id:'qa-att-duplicate',service_id:a.id,service_name:a.name,date,member_id:'qa-member',member_name:'QA Member',status:'present'},
    {id:'qa-att-excused',service_id:a.id,service_name:a.name,date,member_id:'qa-current',member_name:'QA Current',status:'excused'},
    {id:'qa-att-legacy',service_id:'deleted-service',service_name:a.name,date,member_id:'qa-new',member_name:'QA New',status:'present'},
  ];
  const gift=(id,serviceId,name,amount,status='completed')=>({id,service_id:serviceId,service_name:name,member_id:'qa-member',member_name:'QA Member',category:'Offering',amount,status,date,payment_method:'cash',reference_number:id});
  const giving=[gift('QA-GIVING-A',a.id,a.name,10),gift('QA-GIVING-LEGACY',null,a.name,20),gift('QA-GIVING-B',b.id,a.name,5),gift('QA-UNLINKED',null,null,999),gift('QA-DELETED','deleted-service',a.name,200),gift('QA-VOID',a.id,a.name,300,'voided')];
  const roster={id:'qa-roster',service_id:a.id,service_name:a.name,date,member_id:'qa-member',member_name:'QA Member',member_phone:'0241234567',role_title:'Usher',department:'ushers_protocol',report_time:'07:30',status:'pending',created_at:now.toISOString()};
  return {clock,tables:{services:[a,b],attendance,giving,headcounts:[{id:'qa-head',service_id:a.id,service_name:a.name,date,total_auditorium:50},{id:'qa-head-legacy',service_id:'deleted-service',service_name:a.name,date,total_auditorium:80}],roster_assignments:[roster,{...roster,id:'qa-roster-old',service_id:'deleted-service',member_id:'qa-current',member_name:'QA Current'}]}};
}

export async function checkServices(page,{origin,data,profile,mutations,setRejectWrites,userId,clock}) {
  const emptyQueue=()=>waitForSync(page);
  const waitForChange=(table,id)=>page.waitForResponse(response=>response.url().endsWith('/rpc/gwcc_apply_mutations')&&response.request().postDataJSON().p_changes.some(change=>change.table===table&&(!id||change.id===id)));
  const card=id=>page.locator('[data-service-id="'+id+'"]');
  await page.clock.install({time:clock});await page.reload();
  await page.getByText('Service history needs review',{exact:true}).waitFor();
  await page.getByText('Giving Linked to Services',{exact:true}).locator('..').getByText('GH₵ 35.00',{exact:true}).waitFor();
  await card('qa-service-a').getByText('1 check-in',{exact:true}).waitFor();
  await card('qa-service-b').getByText('0 check-ins',{exact:true}).waitFor();
  await page.clock.fastForward(90000);await page.getByText('LIVE SERVICE IN SESSION',{exact:true}).waitFor();

  await card('qa-service-b').getByRole('button',{name:'Check-in',exact:true}).click();
  await page.getByLabel('Attendance service',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('Attendance service',{exact:true}).inputValue(),'qa-service-b');
  await page.goto(origin+'/services');
  await card('qa-service-a').getByRole('button',{name:'Service Giving',exact:true}).click();
  await page.getByLabel('Filter giving by service',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('Filter giving by service',{exact:true}).inputValue(),'qa-service-a');
  assert.equal(await page.getByRole('row').filter({has:page.getByText('GH₵ 999.00',{exact:true})}).count(),0);
  await page.goto(origin+'/services');

  await card('qa-service-a').getByRole('button',{name:'Roster',exact:true}).click();
  const duty=page.getByRole('dialog',{name:'Service duty roster'});
  await duty.waitFor();
  const defaults=await duty.locator('input[type="text"]').evaluateAll(inputs=>inputs.map(input=>input.value));
  assert.ok(!defaults.some(value=>['Sister Abena Serwaa','Pastor Emmanuel Osei','Kwame Mensah','Benjamin Antwi','Clara Gaewornu'].includes(value)));
  assert.equal(await duty.locator('a[href*="233240000000"]').count(),0);
  await duty.getByRole('button',{name:'Close duty roster'}).click();

  setRejectWrites(false);mutations.length=0;
  await card('qa-service-b').getByTitle('Edit service details',{exact:true}).click();
  const form=page.getByRole('dialog',{name:'Edit Church Service'});
  await form.getByLabel('Expected service attendance',{exact:true}).fill('-1');
  assert.equal(await form.getByLabel('Expected service attendance',{exact:true}).evaluate(input=>input.checkValidity()),false);
  await form.getByLabel('Expected service attendance',{exact:true}).fill('55');
  const endTime=await form.getByLabel('Service end time (GMT)',{exact:true}).inputValue();
  await form.getByLabel('Service end time (GMT)',{exact:true}).fill(await form.getByLabel('Service start time (GMT)',{exact:true}).inputValue());
  await form.getByRole('button',{name:'Update Service',exact:true}).click();await page.getByText('Invalid service',{exact:true}).waitFor();
  assert.equal(mutations.some(request=>request.p_changes.some(change=>change.table==='services')),false);
  await form.getByLabel('Service end time (GMT)',{exact:true}).fill(endTime);
  let sync=waitForChange('services','qa-service-b');await form.getByRole('button',{name:'Update Service',exact:true}).click();await sync;await emptyQueue();
  assert.equal(data.services.find(service=>service.id==='qa-service-b').expected_attendance,55);

  await page.getByRole('button',{name:'Duty Roster',exact:true}).click();
  await page.getByRole('button',{name:'WhatsApp Broadcast',exact:true}).click();
  const reminders=page.getByRole('dialog',{name:'Roster reminders'});
  await reminders.getByRole('button',{name:'Confirm All (1) Pending',exact:true}).waitFor();
  sync=waitForChange('roster_assignments','qa-roster');await reminders.getByRole('button',{name:'Confirm All (1) Pending',exact:true}).click();await sync;await emptyQueue();
  assert.equal(data.roster_assignments.find(row=>row.id==='qa-roster').status,'confirmed');
  assert.equal(data.roster_assignments.find(row=>row.id==='qa-roster-old').status,'pending');
  await reminders.getByRole('button',{name:'Close roster reminders'}).click();

  await page.getByRole('button',{name:'Share & Export Schedule',exact:true}).click();
  const sharing=page.getByRole('dialog',{name:'Share service schedule'});
  const download=page.waitForEvent('download');await sharing.getByRole('button',{name:'Export Calendar (.ics)',exact:true}).click();
  const file=await download,chunks=[];for await(const chunk of await file.createReadStream())chunks.push(chunk);
  const ics=Buffer.concat(chunks).toString('utf8');assert.match(ics,/DTSTART:\d{8}T\d{6}Z/);assert.equal(ics.split('\r\n').filter(line=>line==='BEGIN:VEVENT').length,2);
  await sharing.getByRole('button',{name:'Close service schedule'}).click();

  profile.role='attendance_officer';await page.goto(origin+'/services');
  await page.getByText('Restricted',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Schedule New Service',exact:true}).count(),0);
  assert.equal(await card('qa-service-a').getByRole('button',{name:'Roster',exact:true}).isDisabled(),true);
  await page.getByRole('button',{name:/Duty Roster & Conflict Radar/}).click();
  await page.getByRole('button',{name:'WhatsApp Broadcast',exact:true}).click();await reminders.waitFor();
  assert.equal(await reminders.getByRole('button',{name:/Confirm All/}).count(),0);
  await reminders.getByRole('button',{name:'Close roster reminders'}).click();

  profile.role='super_admin';await page.goto(origin+'/services');
  await card('qa-service-a').getByTitle('Delete service',{exact:true}).click();
  const remove=page.getByRole('dialog',{name:'Remove church service'});
  await remove.getByRole('button',{name:'Deactivate Service',exact:true}).waitFor();
  sync=waitForChange('services','qa-service-a');await remove.getByRole('button',{name:'Deactivate Service',exact:true}).click();await sync;await emptyQueue();
  assert.equal(data.services.find(service=>service.id==='qa-service-a').is_active,false);
  assert.equal(data.attendance.length,4);
  assert.equal(mutations.some(request=>request.p_changes.some(change=>change.table==='services'&&change.operation==='delete')),false);
  setRejectWrites(true);mutations.length=0;
  console.info('Services browser checks passed: accurate totals, navigation, live clock, validation/edit persistence, roster confirmation, calendar export, permissions and history protection.');
}
