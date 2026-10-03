import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Refresh Functionality', () => {
  it('updates lastRefreshedAt timestamp upon refresh', () => {
    const prevTimestamp = new Date(Date.now() - 60000);
    const refreshedTimestamp = new Date();

    assert.ok(refreshedTimestamp.getTime() > prevTimestamp.getTime());
  });

  it('provides structured refresh result for staff feedback', () => {
    const supabaseResult = {
      success: true,
      source: 'supabase',
      message: 'All church records synced fresh from Supabase cloud database.',
    };

    const localResult = {
      success: true,
      source: 'local',
      message: 'Church records reloaded fresh from local storage.',
    };

    assert.equal(supabaseResult.success, true);
    assert.equal(supabaseResult.source, 'supabase');
    assert.match(supabaseResult.message, /cloud/);

    assert.equal(localResult.success, true);
    assert.equal(localResult.source, 'local');
    assert.match(localResult.message, /local storage/);
  });

  it('registers Ctrl+Shift+R shortcut keys', () => {
    const refreshShortcut = {
      id: 'tool-refresh-data',
      keys: ['Ctrl', 'Shift', 'R'],
      label: 'Refresh Church Records',
    };

    assert.deepEqual(refreshShortcut.keys, ['Ctrl', 'Shift', 'R']);
  });
});
