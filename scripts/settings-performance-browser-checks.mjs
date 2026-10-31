import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { SQL_MIGRATION_SCHEMA, SQL_FIX_RLS_SCHEMA, SQL_FIX_CHURCH_FINANCE_SCHEMA } from '../src/lib/supabaseSchema.ts';

export async function checkSettingsPerformance(browser, { origin, settings }) {
  const files = readdirSync('dist/assets');
  const settingsAsset = files.find(name => /^SettingsPage-.*\.js$/.test(name));
  const scriptAsset = files.find(name => /^databaseScripts-.*\.json$/.test(name));
  assert.ok(settingsAsset, 'Settings must have a separate page entry.');
  assert.ok(scriptAsset, 'Maintenance SQL must have its own deferred data asset.');
  assert.ok(readFileSync('dist/assets/' + settingsAsset).length < 150000, 'Settings entry exceeds its 150 KB uncompressed budget.');
  const digest = value => createHash('sha256').update(value).digest('hex');
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    let releaseFirst, scriptRequests = 0, mutations = 0, staffCalls = 0;
    const gate = new Promise(resolve => { releaseFirst = resolve; });
    const errors = [];
    const id = '11111111-1111-4111-8111-111111111111';
    const user = { id, email: 'settings@example.test', aud: 'authenticated', role: 'authenticated', email_confirmed_at: '2026-10-01T00:00:00Z', app_metadata: { provider: 'email' }, user_metadata: {} };
    const profile = { id, email: user.email, first_name: 'Settings', last_name: 'Fixture', role: 'super_admin', is_active: true, has_login_account: true, authorization_reviewed_at: '2026-10-01T00:00:00Z' };
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, role: 'authenticated', exp })).toString('base64url')}.synthetic`;
    const session = { user, access_token: token, refresh_token: 'synthetic-only', expires_at: exp, expires_in: 3600, token_type: 'bearer' };
    await context.addInitScript(({ session }) => {
      localStorage.setItem('gwcc_supabase_url', 'https://gwcc-e2e.supabase.co'); localStorage.setItem('gwcc_supabase_anon_key', 'test-public-key'); localStorage.setItem('gwcc-church-auth-token', JSON.stringify(session));
      window.__sqlClipboard = ''; window.__failSqlClipboard = false;
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { if (window.__failSqlClipboard) throw new DOMException('Synthetic clipboard denial', 'NotAllowedError'); window.__sqlClipboard = text; } } });
    }, { session });
    await context.route(origin + '/assets/' + scriptAsset, async route => {
      scriptRequests++;
      if (scriptRequests === 1) { await gate; await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Temporary test outage"}' }); }
      else await route.continue();
    });
    await context.route(origin + '/api/staff', async route => { staffCalls++; await route.fulfill({ status: 403, json: { error: 'Unexpected staff write' } }); });
    await context.route('https://gwcc-e2e.supabase.co/**', async route => {
      const req = route.request(), url = new URL(req.url());
      const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
      if (req.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return; }
      let result = [];
      if (url.pathname === '/auth/v1/user') result = user;
      else if (url.pathname === '/auth/v1/token') result = session;
      else if (url.pathname === '/rest/v1/rpc/gwcc_security_status') result = { role: 'super_admin', required: true, verified_factors: 1, satisfied: true };
      else if (url.pathname === '/rest/v1/rpc/gwcc_apply_mutations') { mutations++; await route.fulfill({ status: 403, headers, json: { message: 'Unexpected write' } }); return; }
      else if (url.pathname.startsWith('/rest/v1/') && !url.pathname.includes('/rpc/')) {
        const table = url.pathname.split('/').at(-1), rows = table === 'profiles' ? [profile] : table === 'settings' ? [{ id: 'gwcc_global_settings', ...settings }] : [];
        const range = req.headers().range?.split('-').map(Number), offset = Number(url.searchParams.get('offset') || range?.[0] || 0), limit = Number(url.searchParams.get('limit') || 500);
        result = req.headers().accept?.includes('vnd.pgrst.object') ? rows[0] || null : rows.slice(offset, offset + limit);
      }
      await route.fulfill({ status: 200, headers, body: JSON.stringify(result) });
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(origin + '/settings'); await page.getByText('Church Settings & Cloud Database Hub', { exact: true }).waitFor();
      assert.equal(scriptRequests, 0, 'Opening Settings must not request the large SQL data asset.');
      await page.getByRole('button', { name: /Appearance & Theme/ }).click();
      await page.getByRole('button', { name: 'Services & Timetable', exact: true }).click();
      assert.equal(scriptRequests, 0, 'Ordinary Settings tabs must not download maintenance scripts.');
      await page.getByRole('button', { name: 'Supabase PostgreSQL Hub', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'Loading database scripts…' }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Copy Full Schema', exact: true }).isDisabled(), true);
      assert.equal(await page.getByRole('button', { name: 'Download .sql', exact: true }).isDisabled(), true);
      await page.getByLabel('Supabase project URL', { exact: true }).fill('https://draft-project.supabase.co');
      await page.getByLabel('Supabase public API key', { exact: true }).fill('draft-public-key');
      releaseFirst();
      await page.getByRole('alert').filter({ hasText: 'Database scripts could not be loaded.' }).waitFor();
      assert.equal(await page.getByLabel('Supabase project URL', { exact: true }).inputValue(), 'https://draft-project.supabase.co');
      await page.getByRole('button', { name: 'Retry loading scripts', exact: true }).click();
      await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Copy Full Schema')?.disabled);
      assert.equal(scriptRequests, 2);
      assert.equal(await page.getByLabel('Supabase public API key', { exact: true }).inputValue(), 'draft-public-key');
      assert.equal(await page.evaluate(() => localStorage.getItem('gwcc_supabase_url')), 'https://gwcc-e2e.supabase.co', 'Loading scripts must not save a connection draft.');
      await page.getByRole('button', { name: 'Copy Full Schema', exact: true }).click();
      await page.getByRole('button', { name: 'Copied Full SQL!', exact: true }).waitFor();
      assert.equal(digest(await page.evaluate(() => window.__sqlClipboard)), digest(SQL_MIGRATION_SCHEMA));
      await page.getByRole('button', { name: 'Copy Church Finance SQL', exact: true }).click();
      await page.getByRole('button', { name: 'Copied Finance SQL!', exact: true }).waitFor();
      assert.equal(digest(await page.evaluate(() => window.__sqlClipboard)), digest(SQL_FIX_CHURCH_FINANCE_SCHEMA));
      await page.evaluate(() => { window.__failSqlClipboard = true; });
      await page.getByRole('button', { name: 'Copy RLS Fix Script', exact: true }).click();
      await page.getByText('Copy failed', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Copied RLS Fix!', exact: true }).count(), 0);
      await page.evaluate(() => { window.__failSqlClipboard = false; });
      await page.getByRole('button', { name: 'Copy RLS Fix Script', exact: true }).click();
      await page.getByRole('button', { name: 'Copied RLS Fix!', exact: true }).waitFor();
      assert.equal(digest(await page.evaluate(() => window.__sqlClipboard)), digest(SQL_FIX_RLS_SCHEMA));
      const previewButton = page.getByRole('button', { name: /Show SQL Script Preview/ });
      await previewButton.click();
      const preview = page.getByRole('button', { name: /Hide SQL Script Preview/ }).locator('..').locator('pre');
      assert.equal(digest(await preview.textContent()), digest(SQL_MIGRATION_SCHEMA));
      const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download .sql', exact: true }).click();
      const file = await download, chunks = []; for await (const chunk of await file.createReadStream()) chunks.push(chunk);
      assert.equal(digest(Buffer.concat(chunks)), digest(SQL_MIGRATION_SCHEMA));
      await page.getByRole('button', { name: /Appearance & Theme/ }).click();
      await page.getByRole('button', { name: 'Supabase PostgreSQL Hub', exact: true }).click();
      assert.equal(scriptRequests, 2, 'Loaded maintenance scripts must be reused.');
      assert.equal(await page.getByLabel('Supabase project URL', { exact: true }).inputValue(), 'https://draft-project.supabase.co');
      if (process.env.TEST_SETTINGS_ARTIFACT_DIR) await page.screenshot({ path: `${process.env.TEST_SETTINGS_ARTIFACT_DIR}/settings-tools-${width}.png`, fullPage: true });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), `Database tools overflow at ${width}px.`);
      assert.deepEqual({ mutations, staffCalls }, { mutations: 0, staffCalls: 0 });
      assert.deepEqual(errors, []);
    } finally { releaseFirst(); await context.close(); }
  }
  console.info('Settings performance checks passed: entry budget, zero SQL download on ordinary tabs, deferred loading, failed-load retry with preserved connection drafts, exact copy/preview/download bytes, honest clipboard failure, cached reuse, zero writes and mobile/desktop layout.');
}
