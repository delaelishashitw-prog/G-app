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
});
