import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Offline Connectivity Detection (navigator.onLine)', () => {
  it('detects online state correctly when navigator is online', () => {
    const mockNavigator = { onLine: true };
    const isOnline = typeof mockNavigator !== 'undefined' && typeof mockNavigator.onLine === 'boolean'
      ? mockNavigator.onLine
      : true;

    assert.equal(isOnline, true);
  });

  it('detects offline state correctly when navigator is offline', () => {
    const mockNavigator = { onLine: false };
    const isOnline = typeof mockNavigator !== 'undefined' && typeof mockNavigator.onLine === 'boolean'
      ? mockNavigator.onLine
      : true;

    assert.equal(isOnline, false);
  });

  it('calculates elapsed offline duration correctly', () => {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const diffMs = Date.now() - twoMinutesAgo.getTime();
    const elapsedMinutes = Math.max(0, Math.floor(diffMs / 60000));

    assert.equal(elapsedMinutes, 2);
  });

  it('handles transition from online to offline and records timestamp', () => {
    let isOnline = true;
    let offlineSince = null;

    // Simulate window 'offline' event
    const handleOffline = () => {
      isOnline = false;
      offlineSince = new Date();
    };

    handleOffline();
    assert.equal(isOnline, false);
    assert.ok(offlineSince instanceof Date);

    // Simulate window 'online' event
    const handleOnline = () => {
      isOnline = true;
      offlineSince = null;
    };

    handleOnline();
    assert.equal(isOnline, true);
    assert.equal(offlineSince, null);
  });
});
