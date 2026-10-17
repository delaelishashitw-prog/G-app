import test from 'node:test';
import assert from 'node:assert/strict';
import {overdueTask,openTask,taskKindsFor,validateTaskInput} from '../src/lib/followUp.ts';
test('follow-up due dates distinguish today, overdue, upcoming and completed work in Ghana calendar dates',()=>{
 const row={status:'open',due_date:'2026-10-16'};assert.equal(overdueTask(row,'2026-10-17'),true);assert.equal(overdueTask({...row,due_date:'2026-10-17'},'2026-10-17'),false);assert.equal(overdueTask({...row,status:'completed'},'2026-10-17'),false);assert.equal(overdueTask({...row,status:'cancelled'},'2026-10-17'),false);assert.equal(openTask({...row,status:'in_progress'}),true);
 assert.throws(()=>validateTaskInput({title:'Call visitor',assigned_to_id:'staff',due_date:'2026-02-31'}),/valid due date/);assert.throws(()=>validateTaskInput({title:'Call visitor',due_date:'2026-10-17'}),/responsible staff/);
});
test('finance staff task choices exclude pastoral and visitor records and members have no staff task entry',()=>{assert.deepEqual(taskKindsFor('finance_officer'),['general']);assert.deepEqual(taskKindsFor('member'),[]);assert.deepEqual(taskKindsFor('unrecognised'),[]);assert.ok(!taskKindsFor('administrator').includes('pastoral'));assert.ok(taskKindsFor('pastor').includes('pastoral'));});
