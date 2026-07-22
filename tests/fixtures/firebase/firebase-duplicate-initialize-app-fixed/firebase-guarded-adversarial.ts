import { initializeApp, getApps } from 'firebase/app';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

// Adversarial: guard using if statement — getApps() IS called, should NOT flag
if (!getApps().length) {
  initializeApp(firebaseConfig);
}
