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
    // background sync to Firestore (best-effort)
    try {
      // dynamic import to avoid forcing firebase on users who don't configure it
      import('./firebase').then(async (mod) => {
        const { ensureSignedIn, getDb } = mod;
        try {
          const user = await ensureSignedIn();
          const db = getDb();
          if (!user || !db) return;
          const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
          const docId = `${user.uid}_${key}`;
          const ref = doc(db, 'milo_user_data', docId);
          try {
            await setDoc(ref, { userId: user.uid, key, value, updatedAt: serverTimestamp() }, { merge: true });
          } catch (err: any) {
            // Defensive: ignore client-side stream/channel 400s (already-closed session) and other transient errors.
            const msg = err?.message || '';
            const status = err?.status || err?.code || null;
            if (status === 400 || /bad request|channel|gsessionid|already closed/i.test(msg)) {
              console.debug('Firestore setDoc returned 400 or channel error - ignoring for best-effort sync', { key, docId, status, message: msg });
            } else {
              // other errors are logged but don't crash the app
              console.warn('Firestore setDoc failed', { key, docId, err });
            }
          }
        } catch (e) {
          // ensureSignedIn or getDb may fail; ignore for best-effort
        }
      }).catch((e) => {
        // ignore import-level failures
      });
    } catch (e) {
      // ignore
    }
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

// Try to fetch latest data from Firestore and write to localStorage (best-effort)
export function syncFromFirestore(userId: string, key: string) {
  try {
    import('./firebase').then(async (mod) => {
      const { ensureSignedIn, getDb } = mod;
      const user = await ensureSignedIn();
      const db = getDb();
      if (!user || !db) return;
      const { doc, getDoc } = await import('firebase/firestore');
      const docId = `${user.uid}_${key}`;
      const ref = doc(db, 'milo_user_data', docId);
      try {
        const snap = await getDoc(ref);
        if (snap && snap.exists()) {
          const data = snap.data();
          if (data && 'value' in data) {
            const k = makeKey(userId, key);
            try { localStorage.setItem(k, JSON.stringify(data.value)); } catch (e) { /* ignore */ }
          }
        }
      } catch (err: any) {
        const msg = err?.message || '';
        const status = err?.status || err?.code || null;
        if (status === 400 || /bad request|channel|gsessionid|already closed/i.test(msg)) {
          console.debug('Firestore getDoc returned 400 or channel error - ignoring for best-effort sync', { key, docId, status, message: msg });
        } else {
          console.warn('Firestore getDoc failed', { key, docId, err });
        }
      }
    }).catch(() => {});
  } catch (e) {
    // ignore
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
    // attempt to remove from Firestore in background (best-effort)
    try {
      import('./firebase').then(async (mod) => {
        const { ensureSignedIn, getDb } = mod;
        const user = await ensureSignedIn();
        const db = getDb();
        if (!user || !db) return;
        const { doc, deleteDoc } = await import('firebase/firestore');
        const docId = `${user.uid}_${key}`;
        const ref = doc(db, 'milo_user_data', docId);
        try {
          await deleteDoc(ref);
        } catch (err: any) {
          const msg = err?.message || '';
          const status = err?.status || err?.code || null;
          if (status === 400 || /bad request|channel|gsessionid|already closed/i.test(msg)) {
            console.debug('Firestore deleteDoc returned 400 or channel error - ignoring for best-effort sync', { key, docId, status, message: msg });
          } else {
            console.warn('Firestore deleteDoc failed', { key, docId, err });
          }
        }
      }).catch(() => {});
    } catch (e) {
      // ignore
    }
  } catch (err) {
    console.warn('clearUserData failed', err);
  }
}
