import test from 'node:test';
import assert from 'node:assert/strict';
import {rosterDate,rosterToday,isUpcomingDuty,selectDutyRoster} from './rosterUtils.ts';
import {generateMyDutyRosterPdf} from './myDutyPdfGenerator.ts';
test('duty scope uses Ghana dates, rejects invalid dates and never falls back from upcoming or a missing selected slip',()=>{
 const rows=[{id:'past',date:'2020-01-01'},{id:'today',date:'2026-10-17'},{id:'future',date:'2026-10-18'},{id:'bad',date:'2026-02-30'}];
 assert.equal(rosterDate('17/10/2026'),'2026-10-17');assert.equal(rosterDate('2026-02-30'),'');
 assert.equal(rosterToday(new Date('2026-10-17T23:30:00-04:00')),'2026-10-18');
 assert.deepEqual(selectDutyRoster(rows,'upcoming',undefined,'2026-10-17').map(r=>r.id),['today','future']);
 assert.deepEqual(selectDutyRoster([rows[0]],'upcoming',undefined,'2026-10-17'),[]);
 assert.deepEqual(selectDutyRoster(rows,'single','missing'),[]);assert.equal(isUpcomingDuty(rows[3],'2026-10-17'),false);
 const member={id:'own',member_id:'GWCC-OWN',first_name:'Synthetic',last_name:'Member'};
 const duty={id:'past',member_id:'own',date:'2020-01-01',service_name:'PAST_DUTY_MARKER',department:'ushers_protocol',role_title:'Synthetic role',report_time:'07:30',status:'pending'};
 const pdf=generateMyDutyRosterPdf({member,settings:{church_name:'Synthetic Church'},assignments:[duty],scope:'upcoming'}).output();
 assert.equal(pdf.includes('PAST_DUTY_MARKER'),false);
});
