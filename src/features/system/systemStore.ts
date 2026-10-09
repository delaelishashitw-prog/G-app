const pendingSaves = new Map<string, unknown>();
let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(`gwcc_${key}`);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

export function saveToStorage<T>(key: string, data: T) {
  pendingSaves.set(key, data);
  if (!saveDebounceTimer) {
    saveDebounceTimer = setTimeout(() => {
      saveDebounceTimer = null;
      pendingSaves.forEach((val, k) => {
        try {
          localStorage.setItem(`gwcc_${k}`, JSON.stringify(val));
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('gwcc_storage_sync', { detail: { key: k } })
            );
          }
        } catch (err) {
          console.error(`Failed to save gwcc_${k}`, err);
        }
      });
      pendingSaves.clear();
    }, 150);
  }
}
