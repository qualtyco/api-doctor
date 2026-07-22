// Proper auth-based rules — no expiry date
const firestoreRules = `
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /userCollections/{userId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      match /documents/{docId} {
        allow read, write: if request.auth != null
          && request.auth.uid == resource.data.ownerId;
      }
    }
  }
`;

export const rules = firestoreRules;
