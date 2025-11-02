import { initializeApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously as fbSignInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Minimal Firebase initialization. Fill env variables in .env for local dev.
const firebaseConfig = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
	storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
	appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let appInitialized = false;
let currentUser: User | null = null;
let _app: FirebaseApp | null = null;

export function initFirebase() {
	try {
		// lazy initialize
		if (!appInitialized) {
			_app = initializeApp(firebaseConfig);
			const auth = getAuth();
			const db = getFirestore();

			// expose a small dev-only handle so you can inspect Firebase from the Console
			try {
				if (import.meta.env.DEV && typeof window !== 'undefined') {
					// attach minimal debug object
					(window as any).__milo_firebase = Object.assign((window as any).__milo_firebase || {}, {
						app: _app,
						auth,
						db,
						getCurrentUser: () => currentUser
					});
				}
			} catch (e) {
				// non-fatal
			}

			onAuthStateChanged(auth, (user) => {
				currentUser = user || null;
				// keep the debug handle up to date
				try {
					if (import.meta.env.DEV && typeof window !== 'undefined' && (window as any).__milo_firebase) {
						(window as any).__milo_firebase.getCurrentUser = () => currentUser;
					}
				} catch (e) {}
			});

			appInitialized = true;
		}
	} catch (err) {
		// swallow errors so runtime doesn't crash when env vars missing
		console.warn('Firebase init failed or not configured', err);
	}
}

export async function ensureSignedIn(): Promise<User | null> {
	try {
		initFirebase();
		const auth = getAuth();
		if (auth.currentUser) return auth.currentUser;
		const result = await fbSignInAnonymously(auth);
		currentUser = result.user;
		return currentUser;
	} catch (err) {
		console.warn('Firebase anonymous sign-in failed', err);
		return null;
	}
}

export function getCurrentUser() {
	return currentUser;
}

export function getDb() {
	try {
		initFirebase();
		return getFirestore();
	} catch (err) {
		return null as any;
	}
}
