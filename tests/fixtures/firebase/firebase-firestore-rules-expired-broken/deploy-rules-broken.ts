import { initializeApp } from 'firebase-admin/app';
import { getSecurityRules } from 'firebase-admin/security-rules';

// Rules with an earlier expired date
const SECURITY_RULES = `
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /{document=**} {
        allow read, write: if request.time < timestamp.date(2024, 12, 31);
      }
    }
  }
`;

export const rules = SECURITY_RULES;

export async function deployRules() {
  await getSecurityRules(initializeApp()).releaseFirestoreRulesetFromSource(SECURITY_RULES);
}
