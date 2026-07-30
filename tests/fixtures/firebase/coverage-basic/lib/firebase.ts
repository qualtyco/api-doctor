import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

export const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: 'demo-app.firebaseapp.com',
  projectId: 'demo-app',
});

export const auth = getAuth(app);
