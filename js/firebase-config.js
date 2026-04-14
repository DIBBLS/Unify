/**
 * Unify — Shared Firebase Configuration
 *
 * Import from this module instead of copy-pasting the config in every page:
 *
 *   import { app, auth, db } from './js/firebase-config.js';
 *   // or from a subdirectory:
 *   import { app, auth, db } from '../../js/firebase-config.js';
 *
 * The module also exports the Google provider so pages don't need to
 * create their own instances.
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyBjZyfNNpXZFJwB7GKXVeSzLTVknfwCa8I',
  authDomain: 'unify-b4316.firebaseapp.com',
  projectId: 'unify-b4316',
  storageBucket: 'unify-b4316.firebasestorage.app',
  messagingSenderId: '114594366615',
  appId: '1:114594366615:web:44ef821b4618f1a24615d2',
  measurementId: 'G-MY2M1R6DJV',
};

export const app      = initializeApp(firebaseConfig);
export const auth     = getAuth(app);
export const db       = getFirestore(app);
export const provider = new GoogleAuthProvider();
