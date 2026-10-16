import assert from 'node:assert/strict';

export function attendanceFixtures(now, members) {
  const date = now.toISOString().slice(0, 10), previous = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
  const day = now.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'Africa/Accra' });
  const a = { id: 'qa-att-service', name: 'QA Attendance Service', type: 'prayer', day_of_week: day, start_time: '08:00', end_time: '10:00', expected_attendance: 100, is_active: true };
  const b = { ...a, id: 'qa-att-other', name: 'QA Other Attendance Service', start_time: '18:30', end_time: '20:00' };
  const archived = { ...a, id: 'qa-archived-service', name: 'QA Archived Service', day_of_week: '', start_time: '', end_time: '', is_active: false };
  const row = (id, extra = {}) => ({ id, service_id: a.id, service_name: a.name, date, member_id: 'qa-member', member_name: 'QA Member', status: 'present', check_in_time: now.toISOString(), check_in_method: 'manual', ...extra });
  const head = { id: 'qa-att-head', service_id: a.id, service_name: a.name, date, men: 2, women: 3, youth: 4, children: 5, visitors: 1, ushers_protocol: 2, online_viewers: 7, total_auditorium: 17, counted_by: 'QA Usher', notes: '', created_at: now.toISOString(), updated_at: now.toISOString() };
  return { date, previous, tables: {
    services: [a, b, archived],
    members: members.map(member => ({ ...member, status: 'active', membership_date: '2020-01-01' })),
    visitors: [{ id: 'qa-att-visitor', full_name: 'QA Visitor', phone: '0240000008', visit_date: date, follow_up_status: 'new' }],
    attendance: [row('qa-att-member'), row('qa-att-member-duplicate'), row('qa-att-visitor-row', { member_id: null, member_name: null, visitor_id: 'qa-att-visitor', visitor_name: 'QA Visitor', person_type: 'member' }),
      row('qa-att-excused', { member_id: 'qa-current', member_name: 'QA Current', status: 'excused' }), row('qa-att-previous', { date: previous, member_id: 'qa-first-payment', member_name: 'QA First Payment' }),
      row('qa-att-other-row', { service_id: b.id, service_name: b.name, member_id: 'qa-new', member_name: 'QA New' })],
    headcounts: [head, { ...head, id: 'qa-att-head-other', service_id: b.id, service_name: b.name, men: 800, women: 0, youth: 0, children: 0, visitors: 0, ushers_protocol: 0, total_auditorium: 800 }],
    child_check_ins: [],
  } };
}

export async function checkAttendance(page, { origin, data, profile, mutations, setRejectWrites, userId, date, previous }) {
  setRejectWrites(false); mutations.length = 0;
  const emptyQueue = () => page.waitForFunction(id => JSON.parse(localStorage.getItem('gwcc_outbox_v2_' + id) || '[]').length === 0, userId);
  const waitForChange = (table, id) => page.waitForResponse(response => response.url().endsWith('/rpc/gwcc_apply_mutations') && response.request().postDataJSON().p_changes.some(change => change.table === table && (!id || change.id === id)));
  const openSession = () => page.goto(`${origin}/attendance?serviceId=qa-att-service&date=${date}`);
  const kpi = label => page.getByText(label, { exact: true }).first().locator('..');
  await openSession();
  await page.getByText('1 members • 1 visitors', { exact: true }).waitFor();
  await kpi('Verified Check-Ins').getByText('2', { exact: true }).waitFor();
  await kpi('Auditorium Headcount').getByText('17', { exact: true }).waitFor();
  await kpi('Headcount + Online Views').getByText('24', { exact: true }).waitFor();
  await page.getByLabel('Attendance person type').selectOption('visitor');
  await page.getByText('Logged Check-Ins (1)', { exact: true }).waitFor();
  await page.getByText('QA Visitor', { exact: true }).waitFor();
  await page.getByLabel('Attendance person type').selectOption('all');

  await page.getByRole('button', { name: 'Not Checked In & Pastoral Follow-Up', exact: false }).click();
  assert.equal(await page.getByRole('row').filter({ has: page.getByText('QA Member', { exact: true }) }).count(), 0);
  await page.getByRole('row').filter({ has: page.getByText('QA Current', { exact: true }) }).waitFor();

  await page.getByRole('button', { name: 'Auditorium Headcount (Usher Board)', exact: true }).click();
  assert.equal(await page.getByLabel('Headcount men', { exact: true }).inputValue(), '2', 'Saved headcount must hydrate after asynchronous loading.');
  await page.getByLabel('Headcount men', { exact: true }).fill('-1');
  assert.equal(await page.getByRole('button', { name: 'Save Headcount', exact: true }).isDisabled(), true);
  await page.getByLabel('Headcount men', { exact: true }).fill('2.5');
  assert.equal(await page.getByRole('button', { name: 'Save Headcount', exact: true }).isDisabled(), true);
  await page.getByLabel('Headcount men', { exact: true }).fill('2');
  await page.getByLabel('Headcount women', { exact: true }).fill('4');
  await page.getByText('Unsaved changes', { exact: true }).waitFor();
  await kpi('Auditorium Headcount').getByText('17', { exact: true }).waitFor();
  const remoteHeadcount = data.headcounts.find(row => row.id === 'qa-att-head');
  Object.assign(remoteHeadcount, { men: 3, total_auditorium: 18, updated_at: new Date(new Date(remoteHeadcount.updated_at).getTime() + 60000).toISOString() });
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByRole('button', { name: 'Load latest saved headcount', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Save Headcount', exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: 'Load latest saved headcount', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[aria-label="Headcount men"]')?.value === '3');
  assert.equal(await page.getByLabel('Headcount men', { exact: true }).inputValue(), '3');
  await page.getByLabel('Headcount men', { exact: true }).fill('2');
  await page.getByLabel('Headcount women', { exact: true }).fill('4');
  let sync = waitForChange('headcounts', 'qa-att-head');
  await page.getByRole('button', { name: 'Save Headcount', exact: true }).click(); await sync; await emptyQueue();
  assert.equal(data.headcounts.find(row => row.id === 'qa-att-head').total_auditorium, 18);
  await kpi('Auditorium Headcount').getByText('18', { exact: true }).waitFor();
  await page.getByLabel('Attendance date (GMT)').fill('2999-01-01');
  assert.equal(await page.getByRole('button', { name: 'Save Headcount', exact: true }).isDisabled(), true);
  await page.getByText('Attendance cannot be recorded for a future date.', { exact: true }).waitFor();
  await page.getByLabel('Attendance date (GMT)').fill(date);

  await page.getByRole('button', { name: 'Session History', exact: true }).click();
  await page.getByText(previous, { exact: true }).waitFor();
  const history = page.getByText('Historical Attendance Logs & Registers', { exact: true }).locator('..').locator('..').locator('..');
  assert.equal(await history.getByText('QA Other Attendance Service', { exact: true }).count(), 0, 'Other service history must not mix with the selected service.');
  const allDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export All Attendance', exact: true }).click();
  const allFile = await allDownload, allChunks = []; for await (const chunk of await allFile.createReadStream()) allChunks.push(chunk);
  assert.match(Buffer.concat(allChunks).toString('utf8'), /QA Other Attendance Service/);

  await page.getByRole('button', { name: 'Live Check-In Terminal', exact: false }).click();
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const file = await download, chunks = []; for await (const chunk of await file.createReadStream()) chunks.push(chunk);
  const csv = Buffer.concat(chunks).toString('utf8');
  assert.ok(!csv.includes('QA Other Attendance Service'));
  assert.ok(!csv.includes('qa-att-member-duplicate'));
  assert.match(csv, /"visitor"/);
  await page.getByRole('button', { name: 'Print Register', exact: true }).click();
  const register = page.getByRole('dialog', { name: 'Attendance register', exact: true });
  await register.getByText('Logged Attendees Roster (2 Recorded)', { exact: true }).waitFor();
  await register.getByRole('button', { name: 'Close attendance register', exact: true }).click();

  await page.getByLabel('Find attendance member').fill('QA Current');
  sync = waitForChange('attendance', 'qa-att-excused');
  await page.getByRole('button', { name: 'Check In', exact: true }).click(); await sync; await emptyQueue();
  assert.equal(data.attendance.find(row => row.id === 'qa-att-excused').status, 'present');
  assert.equal(data.attendance.filter(row => row.member_id === 'qa-current' && row.service_id === 'qa-att-service' && row.date === date).length, 1);

  await page.getByRole('button', { name: '+ Quick Add Visitor', exact: false }).click();
  const visitor = page.getByRole('dialog', { name: 'Register and check in visitor', exact: true });
  await visitor.getByLabel('Visitor full name').fill('QA New Visitor');
  await visitor.getByLabel('Visitor phone number').fill('0240000009');
  sync = waitForChange('visitors');
  await visitor.getByRole('button', { name: 'Register & Check In', exact: true }).click(); await sync; await emptyQueue();
  const registered = data.visitors.find(row => row.full_name === 'QA New Visitor'); assert.ok(registered);
  const registrationBatch = mutations.find(request => request.p_changes.some(change => change.table === 'visitors' && change.id === registered.id));
  assert.ok(registrationBatch.p_changes.some(change => change.table === 'attendance' && change.record.visitor_id === registered.id), 'Registration and check-in must share one transaction.');
  assert.equal(data.attendance.find(row => row.visitor_id === registered.id).person_type, 'visitor');

  await page.getByRole('button', { name: 'Open Check-In Screen', exact: true }).click();
  const screen = page.getByRole('dialog', { name: 'Staff check-in screen', exact: true });
  assert.equal(await screen.getByText(/1234/).count(), 0);
  await screen.getByPlaceholder('Type your phone number or name', { exact: false }).fill('QA New');
  await screen.getByRole('button', { name: 'Check In', exact: true }).first().waitFor();
  sync = waitForChange('attendance');
  await screen.getByRole('button', { name: 'Check In', exact: true }).first().click(); await sync; await emptyQueue();
  assert.equal(data.attendance.find(row => row.member_id === 'qa-new' && row.service_id === 'qa-att-service').check_in_method, 'search');
  await screen.getByRole('button', { name: 'Return to attendance', exact: true }).click();

  const memberEntry = page.getByText('QA Member', { exact: true }).locator('..').locator('..').locator('..');
  await memberEntry.getByTitle('Undo check-in', { exact: true }).click();
  sync = waitForChange('attendance', 'qa-att-member');
  await page.getByRole('button', { name: 'Yes, Reverse Check-In', exact: true }).click(); await sync; await emptyQueue();
  assert.equal(data.attendance.filter(row => row.member_id === 'qa-member' && row.service_id === 'qa-att-service' && row.date === date).length, 0, 'Undo must remove duplicate copies of the same check-in together.');

  await page.getByLabel('Attendance service', { exact: true }).selectOption('qa-archived-service');
  await page.getByText('This service is archived. Select an active service for new records.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Open Check-In Screen', exact: true }).isDisabled(), true);
  await page.getByLabel('Attendance service', { exact: true }).selectOption('qa-att-service');
  await page.getByRole('button', { name: 'Batch Department Check-In', exact: true }).click();
  await page.getByLabel('Select QA First Payment', { exact: true }).check();
  await page.getByRole('button', { name: 'Commit Check-In (1)', exact: true }).waitFor();
  await page.getByLabel('Batch member search').fill('QA Current');
  assert.equal(await page.getByRole('button', { name: 'Commit Check-In (0)', exact: true }).isDisabled(), true);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Auditorium Headcount (Usher Board)', exact: true }).click();
  const layout = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth,
    overflow: [...document.querySelectorAll('main *')].map(element => ({ tag: element.tagName, class: element.className?.baseVal ?? element.className, right: Math.round(element.getBoundingClientRect().right), text: element.textContent?.trim().slice(0, 65) })).filter(element => element.right > innerWidth + 2).slice(0, 20) }));
  if (layout.scroll > layout.width + 2) { console.info('Attendance layout diagnostic:', JSON.stringify(layout)); await page.screenshot({ path: '../rollout-check/attendance-mobile.png', fullPage: true }); }
  assert.ok(layout.scroll <= layout.width + 2, 'Attendance mobile layout overflows.');
  if (process.env.ATTENDANCE_SCREENSHOT_PATH) { await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: process.env.ATTENDANCE_SCREENSHOT_PATH, fullPage: true }); }
  await page.setViewportSize({ width: 1440, height: 1000 });

  profile.role = 'finance_officer'; await openSession();
  await page.getByText('Access Restricted', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Save Headcount', exact: true }).count(), 0);
  profile.role = 'super_admin'; await page.goto(origin + '/services');
  await page.locator('[data-service-id="qa-archived-service"]').getByText('Archived history · original schedule unavailable', { exact: true }).waitFor();
  setRejectWrites(true); mutations.length = 0;
  console.info('Attendance browser checks passed: correct identity/totals, absentee lists, headcount hydration/validation/save, session history, exports, registration transaction, staff screen, archived/future-date restrictions, batch filters, mobile layout and access controls.');
}
