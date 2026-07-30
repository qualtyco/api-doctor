import { initializeApp as bootApp } from 'firebase/app';
import { browserLocalPersistence, initializeAuth as makeAuth } from 'firebase/auth';

const application = bootApp({ projectId: 'demo-app' });
const session = makeAuth(application, { persistence: browserLocalPersistence });

export async function keepSignedIn() {
  await session.setPersistence(browserLocalPersistence);
}

export async function endSession() {
  try {
    await session.signOut();
  } catch (error) {
    console.error('sign-out failed', error);
  }
}
