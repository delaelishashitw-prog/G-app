import test from 'node:test';
import assert from 'node:assert/strict';
import {buildReportSnapshot, reportAttendanceWeeks, reportDatePreset, reportDateError, reportPeriodLabel} from '../src/lib/reportSnapshot.ts';
import {generateChurchReportPdf} from '../src/lib/pdfReportGenerator.ts';
import {initialSettings} from '../src/lib/initialData.ts';
import {ErrorBoundary} from '../src/components/ErrorBoundary.tsx';
import {setCacheOwner} from '../src/lib/storageScope.ts';
import {setSyncIdentity, dbSyncUpsert, exportPendingChanges} from '../src/lib/supabase.ts';

const gift = (id, amount = 100, extra = {}) => ({id, amount, date: '2026-10-24', category: 'Tithe', currency: 'GHS', payment_method: 'cash', member_name: 'Synthetic Member', status: 'completed', created_at: '2026-10-24T12:00:00Z', ...extra});
const ledger = (id, amount, transaction_type, extra = {}) => ({...gift(id, amount), transaction_type, title: 'Synthetic Church Income', account_name: 'Synthetic account', ...extra});
const sources = () => ({members: [], visitors: [], attendance: [], giving: [gift('gift')], expenses: [], churchFinances: [ledger('income', 50, 'income'), ledger('expense', 20, 'expense')], pledges: [], smallGroups: [], ministries: []});
const period = {startDate: '2026-01-01', endDate: '2026-10-24'};

test('screen/export snapshot includes church income once and sums exact cents without changing source records', () => {
  const input = sources(), before = structuredClone(input), result = buildReportSnapshot(input, period);
  assert.equal(result.totals.income, 150); assert.equal(result.totals.expenditure, 20); assert.equal(result.totals.surplus, 130);
  assert.equal(result.totals.memberGiving, 100); assert.equal(result.totals.churchIncome, 50); assert.equal(result.receipts.length, 2);
  assert.deepEqual(input, before);
  const cents = buildReportSnapshot({giving: [gift('one', .1), gift('two', .2)], churchFinances: [ledger('grant', .03, 'grant')]});
  assert.equal(cents.totals.income, .33); assert.equal(cents.totals.otherGiving, 0);
});
test('financial reports omit unconfirmed, voided, unpaid, transferred and other-currency records, preserving legacy expense de-duplication', () => {
  const input = sources();
  input.giving.push(gift('pending', 900, {_sync_status: 'pending'}), gift('void', 900, {status: 'voided'}), gift('usd', 900, {currency: 'USD'}));
  input.churchFinances.push(ledger('transfer', 900, 'transfer'), ledger('unpaid', 900, 'expense', {approval_state: 'approved'}), ledger('queued', 900, 'expense', {_sync_status: 'pending'}), ledger('void-ledger', 900, 'expense', {status: 'voided'}));
  input.expenses.push(gift('queued', 900), gift('void-ledger', 900), gift('legacy', 5));
  const result = buildReportSnapshot(input, period);
  assert.equal(result.totals.income, 150); assert.equal(result.totals.expenditure, 25); assert.equal(result.excludedCurrencyCount, 1);
  assert.deepEqual(result.expenses.map(row => row.id).sort(), ['expense', 'legacy']);
});
test('category, method, search and date selections constrain financial totals and exported rows together', () => {
  const input = sources(); input.churchFinances[0].category = 'Grant'; input.churchFinances[0].payment_method = 'bank_transfer';
  input.giving.push(gift('older', 70, {date: '2024-01-01'}));
  const result = buildReportSnapshot(input, {...period, category: 'Grant', paymentMethod: 'bank_transfer', search: 'Church'});
  assert.equal(result.receipts.length, 1); assert.equal(result.receipts[0].source, 'church'); assert.equal(result.totals.income, 50); assert.equal(result.totals.expenditure, 0);
  assert.equal(buildReportSnapshot(input, {...period, search: 'Unmatched'}).totals.income, 0);
});
test('All Time has no arbitrary cutoffs; Ghana presets handle January and leap years, and YTD ends today', () => {
  assert.deepEqual(reportDatePreset('all'), {startDate: '', endDate: ''});
  assert.deepEqual(reportDatePreset('last_month', '2026-01-01'), {startDate: '2025-12-01', endDate: '2025-12-31'});
  assert.deepEqual(reportDatePreset('last_month', '2024-03-01'), {startDate: '2024-02-01', endDate: '2024-02-29'});
  assert.equal(reportDatePreset('ytd', '2026-10-24').endDate, '2026-10-24');
  assert.equal(buildReportSnapshot({giving: [gift('old', 1, {date: '2001-01-01'}), gift('later', 2, {date: '2050-01-01'})]}, reportDatePreset('all')).totals.income, 3);
  assert.equal(reportPeriodLabel({startDate: '2026-01-01'}), 'From 2026-01-01');
});
test('invalid reporting dates yield a visible validation error and cannot generate an official PDF', () => {
  const invalid = {startDate: '2026-10-25', endDate: '2026-10-24'};
  assert.match(reportDateError(invalid), /start date/); assert.equal(buildReportSnapshot(sources(), invalid).receipts.length, 0);
  assert.match(reportDateError({startDate: '2026-02-30'}), /valid reporting dates/);
  assert.throws(() => generateChurchReportPdf({...sources(), settings: initialSettings}, {...invalid, template: 'financial_executive_summary'}), /start date/);
});
test('financial PDF contains the complete filtered income and matching surplus for both ledger and executive reports', () => {
  for (const template of ['financial_ledger', 'financial_executive_summary', 'comprehensive_executive']) {
    const pdf = generateChurchReportPdf({...sources(), settings: initialSettings}, {...period, template, includeOfficialSeal: false});
    const content = pdf.output().replace(/\0/g, '');
    assert.ok(content.includes('150.00'), template); assert.ok(content.includes('130.00'), template);
    if (template !== 'comprehensive_executive') assert.match(content, /Church.*[Ii]ncome|Church Institutional/);
  }
});
test('directory, pledge and small-group exports follow search/ministry and confirmed-record filters', () => {
  const input = {members: [{id: 'one', first_name: 'Alpha', last_name: 'Person', ministry_name: 'Choir'}, {id: 'two', first_name: 'Other', last_name: 'Person', ministry_name: 'Ushers'}, {id: 'archived', first_name: 'Alpha', last_name: 'Person', ministry_name: 'Choir', is_archived: true}],
    smallGroups: [{id: 'one', name: 'Alpha cell'}, {id: 'two', name: 'Other cell'}],
    pledges: [{id: 'one', member_name: 'Alpha', status: 'active', start_date: '2026-01-01'}, {id: 'old', member_name: 'Alpha', status: 'active', start_date: '2024-01-01'}, {id: 'void', member_name: 'Alpha', status: 'cancelled', start_date: '2026-01-01'}]};
  const result = buildReportSnapshot(input, {...period, search: 'Alpha', ministry: 'Choir'});
  assert.deepEqual(result.members.map(row => row.id), ['one']); assert.deepEqual(result.smallGroups.map(row => row.id), ['one']); assert.deepEqual(result.pledges.map(row => row.id), ['one']);
});
test('weekly report counts preserve every present attendee and replace check-ins only in the same headcount session', () => {
  const row = (id, date = '2026-10-24', service_id = 'service') => ({id, member_id: id, service_id, service_name: 'Sunday', date, status: 'present'});
  const attendees = [row('one'), row('two'), row('three', '2026-10-24', 'other'), row('old', '2024-01-01'), {...row('absent'), status: 'absent'}, row('one')];
  const headcounts = [{id: 'head', date: '2026-10-24', service_id: 'service', service_name: 'Sunday', men: 10, women: 0, youth: 0, children: 0, visitors: 2, ushers_protocol: 0, online_viewers: 99, total_auditorium: 12}];
  const result = buildReportSnapshot({attendance: attendees, headcounts}, period);
  assert.equal(result.attendance.length, 3); assert.equal(result.totals.averageWeeklyAttendance, 13); assert.equal(result.totals.peakWeeklyAttendance, 13);
  assert.equal(reportAttendanceWeeks([row('one'), row('two')], [])[0].totalHeadcount, 2);
});

const memoryStorage = () => {const values = {};Object.defineProperties(values, {getItem: {value: key => values[key] ?? null}, setItem: {writable: true, value: (key, value) => {values[key] = value;}}, removeItem: {value: key => {delete values[key];}}});return values;};
test('crash cache cleanup preserves exact pending queues, version metadata, authentication and other accounts', async () => {
  const savedWindow = globalThis.window, savedStorage = globalThis.localStorage;
  const storage = memoryStorage(); globalThis.localStorage = storage;
  let reloads = 0; globalThis.window = {location: {reload: () => reloads++}, dispatchEvent: () => {}};
  setCacheOwner('one');
  const preserved = {'gwcc_outbox_v2_one': 'legacy request', 'gwcc_outbox_v3_one': 'fallback request', 'gwcc_versions_v2_one': 'versions', 'gwcc-church-auth-token': 'session', 'gwcc_supabase_url': 'configuration', 'gwcc_cache_two_members': 'other account cache', unrelated: 'preserve'};
  Object.assign(storage, preserved, {gwcc_cache_one_members: 'stale current cache'});
  try {
    const boundary = new ErrorBoundary({children: null}); boundary.handleResetCache();
    assert.equal(reloads, 1); assert.equal(storage.gwcc_cache_one_members, undefined);
    for (const [key, value] of Object.entries(preserved)) assert.equal(storage[key], value, key);
  } finally {setCacheOwner(null);globalThis.window = savedWindow;globalThis.localStorage = savedStorage;}
});
test('crash recovery requires a current full pending backup before reload, including memory-only failed storage', async () => {
  const savedWindow = globalThis.window, savedStorage = globalThis.localStorage, savedDocument = globalThis.document;
  const storage = memoryStorage();globalThis.localStorage = storage;
  let reloads = 0, downloads = 0;globalThis.window = {location: {reload: () => reloads++}, dispatchEvent: () => {}};
  globalThis.document = {createElement: () => ({click: () => downloads++})};
  try {
    let fail = false;
    const original = storage.setItem;
    storage.setItem = (name, value) => {if (fail && name.startsWith('gwcc_outbox_')) throw Error('Synthetic quota failure'); original(name, value);};
    await setSyncIdentity('synthetic-failed-owner', 'super_admin'); fail = true;
    await dbSyncUpsert('members', gift('retained-member'));
    const before = exportPendingChanges();assert.ok(before.includes('retained-member'));
    const boundary = new ErrorBoundary({children: null}); boundary.setState = update => {Object.assign(boundary.state, update);};
    boundary.handleReload();boundary.handleResetCache();assert.equal(reloads, 0);assert.match(boundary.state.recoveryMessage, /Export/);
    boundary.handleExportPending();assert.equal(downloads, 1);assert.equal(boundary.state.backupSnapshot, before);
    await dbSyncUpsert('members', gift('newer-member'));boundary.handleReload();assert.equal(reloads, 0, 'An older download cannot authorize loss of newer pending work');
    boundary.handleExportPending();boundary.handleResetCache();assert.equal(reloads, 1);assert.equal(exportPendingChanges(), boundary.state.backupSnapshot);
  } finally {await setSyncIdentity(null);globalThis.window = savedWindow;globalThis.localStorage = savedStorage;globalThis.document = savedDocument;}
});
