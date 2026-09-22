import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBjZyfNNpXZFJwB7GKXVeSzLTVknfwCa8I',
  authDomain: 'unify-b4316.firebaseapp.com',
  projectId: 'unify-b4316',
  storageBucket: 'unify-b4316.firebasestorage.app',
  messagingSenderId: '114594366615',
  appId: '1:114594366615:web:44ef821b4618f1a24615d2',
  measurementId: 'G-MY2M1R6DJV',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const provider = new GoogleAuthProvider();
