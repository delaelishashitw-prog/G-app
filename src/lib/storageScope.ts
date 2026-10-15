let owner: string | null = null;
export const setCacheOwner = (id: string | null) => { owner = id; };
export const getCacheOwner = () => owner;
export const cacheKey = (key: string) => owner ? `gwcc_cache_${owner}_${key}` : null;

export function clearScopedCache() {
  if (!owner || typeof localStorage === 'undefined') return;
  const prefix = `gwcc_cache_${owner}_`;
  for (const key of Object.keys(localStorage)) if (key.startsWith(prefix)) localStorage.removeItem(key);
  // Pending writes are account-scoped separately and survive a deliberate sign-out.
}
