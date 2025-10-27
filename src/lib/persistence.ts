// Lightweight namespaced persistence helpers for per-user history
// WARNING: Uses localStorage for demo/hackathon. For production, migrate to
// secure server-side storage or use encrypted IndexedDB/Secret Manager.

export const PERSIST_PREFIX = 'milo';

// Create or return an anonymous user id and persist it
export function getOrCreateUserId(): string {
  try {
    let userId = localStorage.getItem('milo_user_id');
    if (!userId) {
      userId = `anon_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;
      localStorage.setItem('milo_user_id', userId);
    }
    return userId;
  } catch (err) {
    // fallback deterministic id
    return `anon_fallback`;
  }
}

function makeKey(userId: string, key: string) {
  return `${PERSIST_PREFIX}:${userId}:${key}`;
}

export function saveUserData<T>(userId: string, key: string, value: T) {
  try {
    const k = makeKey(userId, key);
    localStorage.setItem(k, JSON.stringify(value));
  } catch (err) {
    console.warn('Failed to saveUserData', err);
  }
}

export function loadUserData<T>(userId: string, key: string): T | null {
  try {
    const k = makeKey(userId, key);
    const raw = localStorage.getItem(k);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn('Failed to loadUserData', err);
    return null;
  }
}

// Append an item to an array stored at key
export function appendUserArray<T>(userId: string, key: string, item: T, maxItems = 200) {
  try {
    const arr = loadUserData<T[]>(userId, key) || [];
    arr.unshift(item);
    if (arr.length > maxItems) arr.splice(maxItems);
    saveUserData(userId, key, arr);
  } catch (err) {
    console.warn('appendUserArray failed', err);
  }
}

export function clearUserData(userId: string, key: string) {
  try {
    const k = makeKey(userId, key);
    localStorage.removeItem(k);
  } catch (err) {
    console.warn('clearUserData failed', err);
  }
}
