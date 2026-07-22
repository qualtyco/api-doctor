// Renamed import for initializeApp should still be recognized.
import { initializeApp as bootFirebase } from 'firebase/app';
import { getDatabase as getRtdb } from 'firebase/database';

const config = {
  apiKey: process.env.FIREBASE_API_KEY,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
};

export const app = bootFirebase(config);
export const db = getRtdb(app);
