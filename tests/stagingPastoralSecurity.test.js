import test from 'node:test';
import assert from 'node:assert/strict';
import { totp, assertAggregateOnly, assertStagingConfiguration } from '../scripts/staging-pastoral-security.mjs';

test('standard TOTP test vector yields expected 6-digit value', () => {
  // Base32 of public test key 12345678901234567890; RFC 6238 8-digit 94287082 at 59 seconds.
  assert.equal(totp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59000), '287082');
});

test('report validation rejects extra private fields or invalid counts', () => {
  const good = {
    visitors: { total: 1, awaitingFollowUp: 1, contacted: 0, returning: 0, converted: 0, closed: 0, other: 0 },
    myTasks: { open: 1, overdue: 0, visitor: 1, pastoral: 0, general: 0 },
    status: 'recorded', asOf: '2026-10-29', generatedAt: '2026-10-29T11:00:00Z',
    scope: 'Your authorized visitor totals and tasks assigned to you. No personal details are included.',
  };
  assert.equal(assertAggregateOnly(good), true);
  assert.throws(() => assertAggregateOnly({ ...good, phone: 'private' }), /unexpected fields/);
  assert.throws(() => assertAggregateOnly({ ...good, visitors: { ...good.visitors, prayer_request: 'private' } }), /unexpected fields/);
  assert.throws(() => assertAggregateOnly({ ...good, myTasks: { ...good.myTasks, overdue: 2 } }), /Overdue tasks/);
});

test('configuration refuses production hosts and secrets with privileged prefix', () => {
  const fixture = {
    GWCC_STAGING_API_ORIGIN: 'https://g-app-git-feature-pastoral-ai-phase2-dickedem.vercel.app',
    GWCC_STAGING_SUPABASE_URL: 'https://gvnkviqnjyrsilorlofx.supabase.co',
    GWCC_STAGING_ANON_KEY: 'synthetic-public-anon-key',
    GWCC_STAGING_VERCEL_BYPASS_SECRET: 'synthetic-protection-bypass',
    GWCC_STAGING_TEST_USERS: JSON.stringify({
      super_admin: { email: 'super@example.invalid', password: 'not-a-real-password', totpSecret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ' },
      administrator: { email: 'admin@example.invalid', password: 'not-a-real-password', totpSecret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ' },
      pastor: { email: 'pastor@example.invalid', password: 'not-a-real-password' },
      member: { email: 'member@example.invalid', password: 'not-a-real-password' },
    }),
  };
  assert.equal(assertStagingConfiguration(fixture).full, false);
  assert.throws(() => assertStagingConfiguration({ ...fixture,
    GWCC_STAGING_API_ORIGIN: 'https://g-app-pi.vercel.app' }), /must be the protected/);
  assert.throws(() => assertStagingConfiguration({ ...fixture,
    GWCC_STAGING_SUPABASE_URL: 'https://noskcrmvnancdyhvzfin.supabase.co' }), /dedicated GWCC Staging/);
  assert.throws(() => assertStagingConfiguration({ ...fixture,
    GWCC_STAGING_ANON_KEY: 'sb_secret_forbidden_example' }), /public\/anon/);
  assert.throws(() => assertStagingConfiguration({ ...fixture,
    GWCC_STAGING_FULL_MATRIX: 'true' }), /Missing dedicated synthetic staging credentials/);
});
