import assert from 'node:assert/strict';

export async function checkStandaloneReceiptPrint(page) {
  await page.locator('[data-receipt-print-root]').waitFor();
  // A long ledger must not add pages or reveal unrelated rows behind the receipt.
  await page.evaluate(() => {
    const ledger = document.createElement('div');
    ledger.id = 'qa-unrelated-print-ledger';
    ledger.style.height = '4000px';
    ledger.textContent = 'UNRELATED LEDGER AND WEBSITE FOOTER';
    document.querySelector('#root').append(ledger);
  });
  try {
    await page.emulateMedia({ media: 'print' });
    const paper = await page.evaluate(() => ({
      appHidden: getComputedStyle(document.querySelector('#root')).display === 'none',
      receiptVisible: getComputedStyle(document.querySelector('[data-receipt-print-paper]')).display !== 'none',
      rootPosition: getComputedStyle(document.querySelector('[data-receipt-print-root]')).position,
      dialogOverflow: getComputedStyle(document.querySelector('[data-receipt-print-dialog]')).overflow,
    }));
    assert.deepEqual(paper, { appHidden: true, receiptVisible: true, rootPosition: 'static', dialogOverflow: 'visible' });
    const pdf = await page.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true });
    assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length, 1,
      'A normal receipt must print on one page even above a long ledger.');
  } finally {
    await page.emulateMedia({ media: 'screen' });
    await page.evaluate(() => document.querySelector('#qa-unrelated-print-ledger')?.remove());
  }
}

export async function checkUnpostedReceiptPrint(page) {
  await page.emulateMedia({ media: 'print' });
  try {
    assert.equal(await page.locator('[data-receipt-print-paper]').isVisible(), false,
      'Browser printing must not issue a receipt that is awaiting confirmation.');
  } finally {
    await page.emulateMedia({ media: 'screen' });
  }
}
