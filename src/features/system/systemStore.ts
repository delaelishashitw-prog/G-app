import { cacheKey } from '../../lib/storageScope';
export function loadFromStorage<T>(key: string, fallback: T): T {
  const scoped=cacheKey(key); if(!scoped) return fallback;
  try { const saved=localStorage.getItem(scoped);return saved?JSON.parse(saved):fallback; } catch { return fallback; }
}
export function saveToStorage<T>(key:string,data:T) {
  const scoped=cacheKey(key); if(!scoped) return;
  try { localStorage.setItem(scoped,JSON.stringify(data)); } catch(error) {
    window.dispatchEvent(new CustomEvent('gwcc-storage-error',{detail:{message:'Device storage is full. Connect to the internet and sync before closing this page.'}}));
  }
}
