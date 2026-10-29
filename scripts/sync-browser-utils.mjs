export function watchSyncStatus() {
  window.__GWCC_TEST_SYNC_STATUS__ = { success: false, pending: -1 };
  window.addEventListener('gwcc-sync-status', event => { window.__GWCC_TEST_SYNC_STATUS__ = event.detail; });
}
export const waitForSync = page => page.waitForFunction(() => window.__GWCC_TEST_SYNC_STATUS__?.success === true && window.__GWCC_TEST_SYNC_STATUS__?.pending === 0);
export const readSavedOutbox = (page, owner) => page.evaluate(owner => new Promise((resolve, reject) => {
  const request = indexedDB.open('gwcc-sync-v3',1);
  request.onerror=()=>reject(request.error?.message);
  request.onsuccess=()=>{const db=request.result,tx=db.transaction('outboxes','readonly'),read=tx.objectStore('outboxes').get(owner);tx.oncomplete=()=>{db.close();resolve(read.result||null);};tx.onabort=()=>{db.close();reject(tx.error?.message);};};
}),owner);

/** Auto-sync can finish and remove Retry sync before a user click settles. */
export async function retrySyncOrAwait(page) {
  try { await page.getByRole('button',{name:'Retry sync',exact:true}).click({timeout:1500}); }
  catch { await waitForSync(page); }
  await waitForSync(page);
}
