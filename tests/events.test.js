import test from 'node:test';
import assert from 'node:assert/strict';
import {effectiveEventStatus, canMemberRsvp, validateEvent} from '../src/features/events/eventRules.ts';
import {preserveEvent} from '../src/features/events/eventStore.ts';
import {buildEventIcs, generateWhatsAppAnnouncement} from '../src/components/events/eventCalendarExport.ts';
const event={id:'synthetic',title:'Synthetic event',venue:'Synthetic venue',event_type:'conference',start_date:'2026-10-24',end_date:'2026-10-24',start_time:'18:00',end_time:'20:00',status:'upcoming',requires_registration:true,attendees:[],budget:0,expected_attendance:0,updated_at:'2026-10-20T12:00:00.123456+00:00'};
test('Ghana event lifecycle closes RSVP at the exact end time and respects private, cancelled and disabled states',()=>{
  for(const [now,status] of [['17:59','upcoming'],['18:00','ongoing'],['19:59','ongoing'],['20:00','completed']])assert.equal(effectiveEventStatus(event,Date.parse(`2026-10-24T${now}:00Z`)),status);
  for(const status of ['draft','cancelled','completed'])assert.equal(canMemberRsvp({...event,status},Date.parse('2026-10-24T19:00:00Z')),false);
  assert.equal(canMemberRsvp({...event,requires_registration:false},Date.parse('2026-10-24T19:00:00Z')),false);
  assert.equal(canMemberRsvp(event,Date.parse('2026-10-24T20:00:00Z')),false);
  validateEvent(event);
  for(const changes of [{end_time:'17:00'},{start_date:'2026-02-30'},{budget:-1},{budget:1.001},{expected_attendance:1.1},{start_time:'25:00'}])assert.throws(()=>validateEvent({...event,...changes}));
});
test('event admission preserves the exact version, rejects failed storage, and blocks edits to pending events',async()=>{
  let payload;
  await assert.rejects(preserveEvent(event,event,async()=>({durable:false,error:'Synthetic storage failure'})),/Synthetic storage failure/);
  const saved=await preserveEvent(event,event,async(table,record)=>{assert.equal(table,'events');payload=record;return{durable:true,success:false};});
  assert.equal(saved._sync_status,'pending');assert.equal(payload._expected_updated_at,event.updated_at);assert.equal(payload.expected_attendance,0);
  await assert.rejects(preserveEvent(saved,saved,async()=>{throw Error('Must not enqueue twice');}),/Wait for cloud confirmation/);
});
test('calendar export fixes Ghana time, escapes text injection, folds UTF-8 lines and marks cancellations',()=>{
  const text='Title;with,comma\\and\nnew line '+ '🕊️'.repeat(50);
  const ics=buildEventIcs({...event,title:text,venue:'Place\r\nBEGIN:VEVENT',status:'cancelled'},'Synthetic church',new Date('2026-10-20T10:30:00Z'));
  assert.match(ics,/DTSTART:20261024T180000Z\r\nDTEND:20261024T200000Z/);assert.match(ics,/STATUS:CANCELLED/);
  assert.equal(ics.match(/^BEGIN:VEVENT$/gm).length,1);
  for(const line of ics.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);
  const unfolded=ics.replace(/\r\n /g,'');assert.ok(unfolded.includes('SUMMARY:Title\\;with\\,comma\\\\and\\nnew line'));
});

test('event publications reject pending changes and announcements stop inviting people after cancellation or the Ghana end time',()=>{
  const pending={...event,_sync_status:'pending'};
  assert.throws(()=>buildEventIcs(pending),/Wait for cloud confirmation/);
  assert.throws(()=>generateWhatsAppAnnouncement(pending),/Wait for cloud confirmation/);
  const expired=generateWhatsAppAnnouncement(event,'Synthetic church',Date.parse('2026-10-24T20:00:00Z'));
  assert.match(expired,/Status: COMPLETED/);assert.doesNotMatch(expired,/warmly invited/);
  for(const status of ['draft','cancelled']){
    const text=generateWhatsAppAnnouncement({...event,status},'Synthetic church',Date.parse('2026-10-24T17:00:00Z'));
    assert.match(text,new RegExp(`Status: ${status.toUpperCase()}`));assert.doesNotMatch(text,/warmly invited/);
  }
});
