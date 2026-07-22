// Adversarial: App Check is wired up via a namespace import rather than a
// named `initializeAppCheck` import — looks like it might be missing, but
// the call is still present.
import { initializeApp } from 'firebase/app';
import * as appCheckLib from 'firebase/app-check';

export const app = initializeApp({
  apiKey: process.env.FIREBASE_API_KEY,
  projectId: process.env.FIREBASE_PROJECT_ID,
});

appCheckLib.initializeAppCheck(app, {
  provider: new appCheckLib.ReCaptchaV3Provider(process.env.RECAPTCHA_SITE_KEY as string),
  isTokenAutoRefreshEnabled: true,
});
