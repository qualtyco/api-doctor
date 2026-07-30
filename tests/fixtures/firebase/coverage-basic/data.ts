import { getDatabase } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';
import { app } from './lib/firebase';

const db = getFirestore(app);
const rtdb = getDatabase(app);

export function snapshotSettings() {
  // Firestore's only instance method — the modular API is otherwise
  // free-function-first (collection(db, ..), doc(db, ..)).
  return db.toJSON();
}

export function legacyRead() {
  // Compat-style call on a modular Database instance: a verified client whose
  // method is not in the surface — must count as an unknown SDK call.
  return rtdb.ref('messages');
}
