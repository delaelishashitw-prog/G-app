import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as scripts from '../src/lib/supabaseSchema.ts';

test('deferred browser maintenance scripts preserve every canonical migration and repair byte', () => {
  const data = JSON.parse(readFileSync(new URL('../src/lib/databaseScripts.json', import.meta.url), 'utf8'));
  const digest = text => createHash('sha256').update(text).digest('hex');
  assert.equal(digest(data.migration), digest(scripts.SQL_MIGRATION_SCHEMA));
  for (const key of ['SQL_FIX_RLS_SCHEMA', 'SQL_FIX_WELFARE_SCHEMA', 'SQL_FIX_ROSTER_SCHEMA', 'SQL_FIX_CHURCH_FINANCE_SCHEMA']) {
    assert.equal(digest(data.repair), digest(scripts[key]));
  }
  assert.deepEqual(Object.keys(data).sort(), ['migration', 'repair']);
});
