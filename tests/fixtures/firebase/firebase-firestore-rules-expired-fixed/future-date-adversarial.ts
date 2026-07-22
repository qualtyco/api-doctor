// Adversarial: timestamp.date in the future — should NOT flag
// (In real use this would still be a bad pattern, but the rule
//  only detects dates that have already passed.)
const devRules = `
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /{document=**} {
        allow read, write: if request.time < timestamp.date(2030, 1, 1);
      }
    }
  }
`;

export const rules = devRules;
