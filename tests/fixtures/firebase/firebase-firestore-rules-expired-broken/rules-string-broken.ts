import { setLogLevel } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Firestore rules embedded as a string for programmatic deployment
const firestoreRules = `
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /{document=**} {
        allow read, write: if request.time < timestamp.date(2025, 4, 12);
      }
    }
  }
`;

export async function deployRules(db: ReturnType<typeof getFirestore>) {
  console.log('Deploying rules:', firestoreRules);
}
