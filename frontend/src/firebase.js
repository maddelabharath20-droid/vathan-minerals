import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

// VATHAN MINERALS Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDw6Fk3TVzleL5cU7xjiZs0ixC02hxZeA8",
  authDomain: "vathan-minerals.firebaseapp.com",
  projectId: "vathan-minerals",
  storageBucket: "vathan-minerals.firebasestorage.app",
  messagingSenderId: "734610124221",
  appId: "1:734610124221:web:78ef5a071331accf62b6d4",
  measurementId: "G-MJ5QK90KWL"
};

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
export const GOOGLE_CLIENT_ID = "734610124221-dsoq0g2p0fk6klrdn1762v9stjet52j8.apps.googleusercontent.com";

/**
 * Attempts standard Google popup sign-in.
 * Returns { success: true, user } or { success: false, error }.
 * Never throws an unhandled exception.
 */
export async function tryGooglePopup() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const idToken = await user.getIdToken();
    return {
      success: true,
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email.split('@')[0],
        photoURL: user.photoURL,
        idToken
      }
    };
  } catch (err) {
    return {
      success: false,
      error: err
    };
  }
}

export async function firebaseSignOut() {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn('Firebase signout ignored:', e);
  }
}
