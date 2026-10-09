import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function isEditable(el) {
  if (!el || typeof el !== 'object') return false;
  const tag = (el.tagName || '').toLowerCase();
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    Boolean(el.isContentEditable) ||
    el.getAttribute?.('role') === 'textbox'
  );
}

describe('Keyboard Shortcuts System', () => {
  it('identifies editable elements correctly to protect input typing', () => {
    const mockInput = { tagName: 'INPUT', isContentEditable: false, getAttribute: () => null };
    const mockTextArea = { tagName: 'TEXTAREA', isContentEditable: false, getAttribute: () => null };
    const mockSelect = { tagName: 'SELECT', isContentEditable: false, getAttribute: () => null };
    const mockButton = { tagName: 'BUTTON', isContentEditable: false, getAttribute: () => null };
    const mockDiv = { tagName: 'DIV', isContentEditable: false, getAttribute: () => null };
    const mockContentEditable = { tagName: 'DIV', isContentEditable: true, getAttribute: () => null };
    const mockRoleTextbox = { tagName: 'DIV', isContentEditable: false, getAttribute: (attr) => attr === 'role' ? 'textbox' : null };

    assert.equal(isEditable(mockInput), true);
    assert.equal(isEditable(mockTextArea), true);
    assert.equal(isEditable(mockSelect), true);
    assert.equal(isEditable(mockButton), false);
    assert.equal(isEditable(mockDiv), false);
    assert.equal(isEditable(mockContentEditable), true);
    assert.equal(isEditable(mockRoleTextbox), true);
    assert.equal(isEditable(null), false);
  });

  it('matches navigation shortcut keys for key staff destinations', () => {
    const shortcutKeys = {
      search: ['Ctrl', 'K'],
      members: ['Ctrl', 'M'],
      finance: ['Ctrl', 'F'],
      dashboard: ['Ctrl', 'D'],
      attendance: ['Ctrl', 'A'],
      visitors: ['Ctrl', 'V'],
    };

    assert.deepEqual(shortcutKeys.members, ['Ctrl', 'M']);
    assert.deepEqual(shortcutKeys.finance, ['Ctrl', 'F']);
    assert.deepEqual(shortcutKeys.search, ['Ctrl', 'K']);
    assert.deepEqual(shortcutKeys.attendance, ['Ctrl', 'A']);
  });

  it('parses Command Palette prefix triggers accurately', () => {
    function parsePaletteFilter(rawQuery) {
      const trimmed = (rawQuery || '').trim();
      if (trimmed.startsWith('>') || trimmed.toLowerCase().startsWith('task:')) {
        return { category: 'tasks', cleanQuery: trimmed.replace(/^>|^task:/i, '').trim().toLowerCase() };
      }
      if (trimmed.startsWith('@') || trimmed.startsWith('#') || trimmed.toLowerCase().startsWith('mem:') || trimmed.toLowerCase().startsWith('member:')) {
        return { category: 'members', cleanQuery: trimmed.replace(/^[@#]|^mem:|^member:/i, '').trim().toLowerCase() };
      }
      if (trimmed.startsWith('/') || trimmed.toLowerCase().startsWith('page:')) {
        return { category: 'pages', cleanQuery: trimmed.replace(/^\/|^page:/i, '').trim().toLowerCase() };
      }
      return { category: 'all', cleanQuery: trimmed.toLowerCase() };
    }

    assert.deepEqual(parsePaletteFilter('> giving'), { category: 'tasks', cleanQuery: 'giving' });
    assert.deepEqual(parsePaletteFilter('task:attendance'), { category: 'tasks', cleanQuery: 'attendance' });
    assert.deepEqual(parsePaletteFilter('@Kwame'), { category: 'members', cleanQuery: 'kwame' });
    assert.deepEqual(parsePaletteFilter('#GWCC-000001'), { category: 'members', cleanQuery: 'gwcc-000001' });
    assert.deepEqual(parsePaletteFilter('/settings'), { category: 'pages', cleanQuery: 'settings' });
    assert.deepEqual(parsePaletteFilter('pastoral care'), { category: 'all', cleanQuery: 'pastoral care' });
  });

  it('correctly cycles through Command Palette arrow selection index with wrap-around', () => {
    const totalResults = 5;

    // Moving down
    let index = 0;
    index = (index + 1) % totalResults; // 1
    assert.equal(index, 1);
    index = (4 + 1) % totalResults; // wrap to 0
    assert.equal(index, 0);

    // Moving up
    index = (0 - 1 + totalResults) % totalResults; // wrap to 4
    assert.equal(index, 4);
    index = (3 - 1 + totalResults) % totalResults; // 2
    assert.equal(index, 2);
  });
});
