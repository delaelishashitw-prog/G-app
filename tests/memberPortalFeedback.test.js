import assert from 'node:assert/strict';
import test from 'node:test';
import {
  memberPortalRefreshWarning,
  MEMBER_PORTAL_REFRESH_WARNING,
} from '../src/features/members/memberPortalFeedback.ts';

test('member portal shows no refresh warning after confirmed cloud refresh', async () => {
  assert.equal(await memberPortalRefreshWarning(async () => ({
    success: true,
    source: 'supabase',
  })), '');
});

test('member portal warns when directory refresh reports cloud failure', async () => {
  assert.equal(await memberPortalRefreshWarning(async () => ({
    success: false,
    source: 'supabase',
  })), MEMBER_PORTAL_REFRESH_WARNING);
});

test('member portal does not mistake offline/local fallback for confirmed cloud refresh', async () => {
  assert.equal(await memberPortalRefreshWarning(async () => ({
    success: true,
    source: 'local',
  })), MEMBER_PORTAL_REFRESH_WARNING);
});

test('member portal turns thrown refresh errors into warnings without throwing', async () => {
  assert.equal(await memberPortalRefreshWarning(async () => {
    throw new Error('Network temporarily unavailable');
  }), MEMBER_PORTAL_REFRESH_WARNING);
});
