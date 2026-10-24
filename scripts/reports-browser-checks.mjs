import assert from 'node:assert/strict';
import {readFile, copyFile, mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {build} from 'vite';
import {watchSyncStatus} from './sync-browser-utils.mjs';

const owner = '71717171-7171-4171-8171-717171717171';
const pdfText = async download => (await readFile(await download.path())).toString('latin1').replace(/\0/g, '');
const csvText = async download => {const chunks = []; for await (const chunk of await download.createReadStream()) chunks.push(chunk); return Buffer.concat(chunks).toString('utf8');};
const download = async (page, button) => {const ready = page.waitForEvent('download'); await button.click(); return ready;};

export async function checkReportsAndRecovery(browser, {origin, settings, sampleMember}) {
  if(process.env.TEST_REPORTS_CRASH_ONLY){await checkCrashRecovery(browser,origin);console.info('Crash recovery browser checks passed.');return;}
  const now = new Date().toISOString(), today = new Intl.DateTimeFormat('en-CA', {timeZone: 'Africa/Accra', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const user = {id: owner, email: 'review@example.test', email_confirmed_at: now, aud: 'authenticated', role: 'authenticated', app_metadata: {provider: 'email'}, user_metadata: {}};
  const profile = {id: owner, email: user.email, role: 'super_admin', first_name: 'Synthetic', last_name: 'Reviewer', is_active: true, has_login_account: true, authorization_reviewed_at: now};
  const token = Buffer.from('{"alg":"HS256"}').toString('base64url') + '.' + Buffer.from(JSON.stringify({sub: owner, role: 'authenticated', exp, aal: 'aal2', session_id: owner})).toString('base64url') + '.synthetic-signature';
  const session = {user, access_token: token, refresh_token: 'synthetic-only', expires_at: exp, expires_in: 3600, token_type: 'bearer'};
  const gift = (id, amount, extra = {}) => ({id, amount, member_name: '=1+1', category: 'Tithe', currency: 'GHS', payment_method: 'cash', reference_number: 'REF-"quoted"', date: today, status: 'completed', created_at: now, updated_at: now, ...extra});
  const finance = (id, amount, transaction_type, extra = {}) => ({...gift(id, amount), transaction_type, title: 'InstitutionalTestOnly', category: 'Grant', account_name: 'Synthetic Bank', payment_method: 'bank_transfer', ...extra});
  const member = (id, first, ministry) => ({...sampleMember, id, member_id: 'GWCC-' + id, first_name: first, last_name: 'ReviewPerson', ministry_name: ministry, is_archived: false, updated_at: now});
  const tables = {profiles: [profile], settings: [{id: 'gwcc_global_settings', ...settings}], members: [member('990001', 'Alpha', 'Choir'), member('990002', 'Other', 'Ushers')],
    giving: [gift('giving', 100), gift('historical', 40, {date: '2024-02-01', member_name: 'HistoricalGift2024'}), gift('void', 900, {status: 'voided'}), gift('foreign', 800, {currency: 'USD'})],
    church_finances: [finance('income', 50, 'income'), finance('expense', 20, 'expense', {category: 'Utilities'}), finance('request', 500, 'expense', {status: 'pending', approval_state: 'requested'}), finance('transfer', 500, 'transfer')],
    headcounts: [{id: 'head', service_id: 'counted', service_name: 'Sunday', date: today, men: 10, women: 0, youth: 0, children: 0, visitors: 2, ushers_protocol: 0, online_viewers: 99, total_auditorium: 12}],
    attendance: [{id: 'a1', member_id: '990001', member_name: 'Alpha ReviewPerson', service_id: 'counted', service_name: 'Sunday', date: today, status: 'present'}, {id: 'a2', member_id: '990002', service_id: 'other', service_name: 'Midweek', date: today, status: 'present'}],
    small_groups: [{id: 'cell-one', name: 'Alpha CellOnly', leader_name: 'Synthetic Leader', member_count: 1}, {id: 'cell-two', name: 'Other CellOnly', leader_name: 'Synthetic Other', member_count: 1}],
    ministries: [{id: 'choir', name: 'Choir'}, {id: 'ushers', name: 'Ushers'}]};
  const context = await browser.newContext({viewport: {width: 1440, height: 1000}, timezoneId: 'Africa/Accra'}), errors = [], mutations = [];
  let page;
  try {
    await context.addInitScript(watchSyncStatus);
    await context.addInitScript(({session}) => {localStorage.setItem('gwcc_supabase_url', 'https://gwcc-e2e.supabase.co'); localStorage.setItem('gwcc_supabase_anon_key', 'test-public-key'); localStorage.setItem('gwcc-church-auth-token', JSON.stringify(session));}, {session});
    await context.route('https://gwcc-e2e.supabase.co/**', async route => {
      const request = route.request(), url = new URL(request.url()), headers = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json'};
      if (request.method() === 'OPTIONS') {await route.fulfill({status: 204, headers}); return;}
      let data = [];
      if (url.pathname === '/auth/v1/user') data = user;
      else if (url.pathname === '/auth/v1/token') data = session;
      else if (url.pathname === '/rest/v1/rpc/gwcc_security_status') data = {role: 'super_admin', required: true, verified_factors: 1, satisfied: true};
      else if (url.pathname === '/rest/v1/rpc/gwcc_apply_mutations') {mutations.push(request.postDataJSON()); data = [];}
      else if (url.pathname.startsWith('/rest/v1/')) {
        const name = url.pathname.split('/').at(-1), rows = tables[name] || [], offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 500);
        data = request.headers().accept?.includes('vnd.pgrst.object') ? rows[0] || null : rows.slice(offset, offset + limit);
      }
      await route.fulfill({status: 200, headers, json: data});
    });
    page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/reports'); await page.getByText(/GH₵\s*130\.00/).first().waitFor();
    await page.getByText('InstitutionalTestOnly', {exact: true}).waitFor();
    const quick = page.getByRole('button', {name: 'Quick PDF', exact: true}), csv = page.getByRole('button', {name: 'Download CSV', exact: true});
    let file = await download(page, quick), text = await pdfText(file); assert.ok(text.includes('150.00') && text.includes('130.00') && text.includes('InstitutionalTestOnly'));
    if (process.env.TEST_REPORTS_PDF) await copyFile(await file.path(), process.env.TEST_REPORTS_PDF);
    const exported = await csvText(await download(page, csv)); assert.ok(exported.includes('Church income') && exported.includes('"\'=1+1"') && exported.includes('REF-""quoted""'));
    assert.ok(!exported.includes('900.00') && !exported.includes('800.00') && !exported.includes('500.00'));
    const search = page.getByPlaceholder('Filter financial...', {exact: true});
    await search.fill('InstitutionalTestOnly'); await page.getByText('Ledger Subtotal: GH₵ 50.00', {exact: true}).waitFor();
    text = await pdfText(await download(page, quick)); assert.ok(text.includes('50.00') && text.includes('InstitutionalTestOnly')); assert.ok(!text.includes('=1+1'));
    await page.getByRole('button', {name: /Export Official PDF Report/}).click(); let modal = page.getByRole('dialog', {name: 'Export official PDF report', exact: true});
    await modal.waitFor(); assert.ok((await modal.innerText()).includes('Search: InstitutionalTestOnly'));
    text = await pdfText(await download(page, modal.getByRole('button', {name: 'Download PDF', exact: true}))); assert.ok(text.includes('InstitutionalTestOnly') && !text.includes('=1+1'));
    await search.fill(''); await page.getByRole('button', {name: 'All Time', exact: true}).click();
    assert.ok((await csvText(await download(page, csv))).includes('HistoricalGift2024'));
    await page.getByRole('button', {name: /Export Official PDF Report/}).click(); modal = page.getByRole('dialog', {name: 'Export official PDF report', exact: true});
    assert.equal(await modal.locator('input[type=date]').first().inputValue(), '');
    text = await pdfText(await download(page, modal.getByRole('button', {name: 'Download PDF', exact: true}))); assert.ok(text.includes('HistoricalGift2024'));
    await page.getByRole('button', {name: 'Executive Treasury', exact: true}).click();
    text = await pdfText(await download(page, quick)); assert.ok(text.includes('190.00') && text.includes('170.00') && text.includes('Church Institutional Income'));
    const summaryCsv=await csvText(await download(page,csv));assert.ok(summaryCsv.includes('Total income')&&summaryCsv.includes('190.00')&&summaryCsv.includes('Total expenditure')&&summaryCsv.includes('20.00')&&summaryCsv.includes('Net surplus / deficit')&&summaryCsv.includes('170.00'));
    await page.getByRole('button', {name: 'Membership Roster', exact: true}).click();
    await page.getByPlaceholder('Filter membership...', {exact: true}).fill('Alpha');
    text = await pdfText(await download(page, quick)); assert.ok(text.includes('Alpha ReviewPerson') && !text.includes('Other ReviewPerson'));
    await page.getByRole('button', {name: /Export Official PDF Report/}).click(); modal = page.getByRole('dialog', {name: 'Export official PDF report', exact: true});
    text = await pdfText(await download(page, modal.getByRole('button', {name: 'Download PDF', exact: true}))); assert.ok(text.includes('Alpha ReviewPerson') && !text.includes('Other ReviewPerson'));
    await page.getByRole('button', {name: 'Financial Ledger', exact: true}).click();
    const dates = page.locator('input[type=date]'); await dates.first().fill('2026-10-25'); await dates.nth(1).fill('2026-10-24');
    await page.getByRole('alert').filter({hasText: 'start date'}).waitFor(); assert.equal(await quick.isDisabled(), true); assert.equal(await csv.isDisabled(), true);
    await page.getByRole('button', {name: 'All Time', exact: true}).click(); await page.setViewportSize({width: 390, height: 844});
    await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth+2,null,{timeout:5000}).catch(()=>{});
    const fits=await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2);
    if(!fits){await page.screenshot({path:'/tmp/gwcc-reports-overflow.png'});console.error('Report overflow',await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,elements:[...document.querySelectorAll('main *')].filter(el=>el.getBoundingClientRect().right>innerWidth+2&&getComputedStyle(el).position!=='fixed').slice(0,12).map(el=>({tag:el.tagName,classes:el.className,width:Math.round(el.getBoundingClientRect().width),text:el.textContent?.slice(0,70)}))})));}
    assert.ok(fits, 'Reports fit a phone viewport');
    if (process.env.TEST_REPORTS_MOBILE) await page.screenshot({path: process.env.TEST_REPORTS_MOBILE});
    await page.getByRole('button', {name: /Export Official PDF Report/}).click(); modal = page.getByRole('dialog', {name: 'Export official PDF report', exact: true});
    await modal.waitFor(); assert.ok(await modal.evaluate(element => {const r = element.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1;}));
    assert.equal(mutations.length, 0, 'Report viewing and exporting never write church records'); assert.deepEqual(errors, []);
  } catch (error) {if (page) console.error('Report check screen', page.url(), (await page.locator('body').innerText({timeout: 2000})).slice(0, 2000)); throw error;}
  finally {await context.close();}
  await checkCrashRecovery(browser, origin);
  console.info('Reports/recovery checks passed: matching screen/CSV/quick and configured PDFs, institutional income, exact filters, complete history, formula escaping, invalid date controls, mobile layout, cache-only cleanup, protected legacy/fallback/IndexedDB queues and complete current backups before reload.');
}

async function checkCrashRecovery(browser, origin) {
  const root = process.cwd();
  const fixture = `import React from ${JSON.stringify(resolve(root, 'node_modules/react/index.js'))};
    import {createRoot} from ${JSON.stringify(resolve(root, 'node_modules/react-dom/client.js'))};
    import {ErrorBoundary} from ${JSON.stringify(resolve(root, 'src/components/ErrorBoundary.tsx'))};
    import {setSyncIdentity,dbSyncUpsert,exportPendingChanges} from ${JSON.stringify(resolve(root, 'src/lib/supabase.ts'))};
    import {setCacheOwner} from ${JSON.stringify(resolve(root, 'src/lib/storageScope.ts'))};
    const owner=${JSON.stringify(owner)};
    const change=id=>dbSyncUpsert('members',{id,first_name:'Synthetic',last_name:'Recovery',phone:'0240000000',profile_photo_url:'data:image/png;base64,'+'A'.repeat(20000)});
    window.__GWCC_CRASH_TEST__={async start(){await setSyncIdentity(owner,'super_admin');await change('first-pending');setCacheOwner(owner);
      localStorage.setItem('gwcc_cache_'+owner+'_members','stale cache');localStorage.setItem('gwcc_cache_other_members','keep other account');
      localStorage.setItem('gwcc_outbox_v2_other','preserve legacy queue');localStorage.setItem('gwcc_outbox_v3_other','preserve fallback queue');
      localStorage.setItem('gwcc-church-auth-token','preserve synthetic authentication');localStorage.setItem('gwcc_supabase_anon_key','preserve configuration');
      const Crash=()=>{throw Error('Synthetic crash for recovery verification');};createRoot(document.getElementById('crash-root')).render(React.createElement(ErrorBoundary,null,React.createElement(Crash)));},
      async failStorage(){const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,...args){if(this.name==='outboxes'&&value.batches?.length)throw new DOMException('Synthetic quota failure','QuotaExceededError');return original.call(this,value,...args);};await change('memory-only-pending');},export:exportPendingChanges};`;
  const temp = await mkdtemp(resolve(tmpdir(), 'gwcc-crash-check-')), entry = resolve(temp, 'fixture.mjs');
  let result;
  try {
    await writeFile(entry, fixture);
    result = await build({configFile: false, envDir: false, root, logLevel: 'silent', define: {'process.env.NODE_ENV': JSON.stringify('production'), 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(''), 'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('')}, build: {write: false, minify: false, lib: {entry, formats: ['iife'], name: 'CrashRecoveryTest'}}});
  } finally {await rm(temp, {recursive: true, force: true});}
  const output = (Array.isArray(result) ? result : [result]).flatMap(item => item.output).find(item => item.type === 'chunk'); assert.ok(output?.code);
  const context = await browser.newContext();
  try {
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await context.route('**/__crash-recovery-test', route => route.fulfill({contentType: 'text/html', body: '<!doctype html><html><body><div id="crash-root"></div></body></html>'}));
    const page = await context.newPage(); const runtimeErrors=[]; page.on('pageerror',error=>runtimeErrors.push(error.message)); page.setDefaultTimeout(15000); await page.goto(origin + '/__crash-recovery-test');
    await page.addScriptTag({content: output.code}); assert.ok(await page.evaluate(()=>Boolean(window.__GWCC_CRASH_TEST__)),runtimeErrors.join('; ')); await page.evaluate(() => window.__GWCC_CRASH_TEST__.start());
    await page.getByRole('heading', {name: 'Application Notice', exact: true}).waitFor();
    const clear = page.getByRole('button', {name: 'Clear Page Cache & Reload', exact: true}), backup = page.getByRole('button', {name: 'Export pending backup', exact: true});
    await clear.click(); await page.getByRole('status').filter({hasText: 'Export the latest'}).waitFor();
    assert.equal(await page.evaluate(owner => localStorage.getItem('gwcc_cache_' + owner + '_members'), owner), 'stale cache');
    const first = JSON.parse(await csvText(await download(page, backup)));
    await page.evaluate(() => window.__GWCC_CRASH_TEST__.failStorage()); await clear.click();
    await page.getByRole('status').filter({hasText: 'Export the latest'}).waitFor();
    const current = JSON.parse(await csvText(await download(page, backup)));
    assert.equal(current.batches[0].id, first.batches[0].id);
    assert.deepEqual(current.batches[0].changes.filter(row=>row.id==='first-pending'), first.batches[0].changes);
    const records = current.batches.flatMap(batch => batch.changes); assert.ok(records.some(row => row.id === 'memory-only-pending'));
    assert.ok(records.every(row => row.record.profile_photo_url.length > 20000), 'Recovery backup retains complete pending photos');
    await Promise.all([page.waitForEvent('load'), clear.click()]);
    const preserved = await page.evaluate(owner => ({cache: localStorage.getItem('gwcc_cache_' + owner + '_members'), other: localStorage.getItem('gwcc_cache_other_members'), legacy: localStorage.getItem('gwcc_outbox_v2_other'), fallback: localStorage.getItem('gwcc_outbox_v3_other'), auth: localStorage.getItem('gwcc-church-auth-token'), config: localStorage.getItem('gwcc_supabase_anon_key')}), owner);
    assert.deepEqual(preserved, {cache: null, other: 'keep other account', legacy: 'preserve legacy queue', fallback: 'preserve fallback queue', auth: 'preserve synthetic authentication', config: 'preserve configuration'});
    const disk = await page.evaluate(owner => new Promise((resolve, reject) => {const request = indexedDB.open('gwcc-sync-v3', 1); request.onerror = () => reject(request.error); request.onsuccess = () => {const db = request.result, tx = db.transaction('outboxes'), read = tx.objectStore('outboxes').get(owner); read.onsuccess = () => {resolve(read.result); db.close();}; read.onerror = () => reject(read.error);};}), owner);
    assert.deepEqual(disk.batches, first.batches, 'Cache recovery never clears or rewrites the durable pending requests');
  } finally {await context.close();}
}
