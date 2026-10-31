import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCESS_MODULES } from '../src/lib/accessModules.ts';
import { staffProfileAccessBlockers } from '../src/lib/staffAccessReview.ts';
import { ROLE_PERMISSIONS } from '../src/contexts/AuthContext.tsx';

test('access review labels cover every actual role grant without duplicate or invented modules', () => {
  const ids = ACCESS_MODULES.map(module => module.id);
  const grants = new Set(Object.values(ROLE_PERMISSIONS).flat());
  assert.equal(ids.length, new Set(ids).size);
  assert.deepEqual(new Set(ids), grants);
});

test('active does not imply sign-in eligibility for unreviewed or directory-only staff', () => {
  const staff = { role: 'finance_officer', is_active: true, has_login_account: true };
  assert.match(staffProfileAccessBlockers(staff).join(' '), /Administrator review/);
  assert.match(staffProfileAccessBlockers({ ...staff, has_login_account: false }).join(' '), /Directory only/);
  assert.deepEqual(staffProfileAccessBlockers({ ...staff, authorization_reviewed_at: '2026-10-31T00:00:00Z' }), []);
});

test('suspension and invalid roles remain blockers, while member profiles do not require staff approval', () => {
  assert.match(staffProfileAccessBlockers({ role: 'pastor', is_active: false, has_login_account: true, authorization_reviewed_at: '2026-10-31T00:00:00Z' }).join(' '), /suspended/);
  assert.match(staffProfileAccessBlockers({ role: 'unknown', is_active: true, has_login_account: true }).join(' '), /security role needs administrator review/);
  assert.deepEqual(staffProfileAccessBlockers({ role: 'member', is_active: true, has_login_account: true }), []);
});
