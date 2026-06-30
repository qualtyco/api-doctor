# Firebase

20 oxlint rules for the [Firebase](https://firebase.google.com) modular JS SDK (`firebase/app`, `firebase/auth`, `firebase/firestore`, `firebase/database`, `firebase/app-check`, `firebase-admin`).


|                          |                                       |
| ------------------------ | ------------------------------------- |
| **Manifest**             | [manifest.ts](manifest.ts)            |
| **Rule implementations** | [rules/](rules/)                      |
| **Shared AST helpers**   | [utils.ts](utils.ts)                  |
| **Fixtures**              | `tests/fixtures/firebase/`            |
| **Rule tests**           | `tests/rules/firebase-*.test.ts`      |


Detection: `firebase` in package.json, `import from 'firebase/app'`/`'firebase/auth'`/`'firebase/database'`/`'firebase/app-check'`, or `firebaseio.com`/`firebaseapp.com` in source.

---

## Rules and tests by category

### Security

| Rule | Severity | CWE / OWASP | Firebase docs | Rule file |
| ---- | -------- | ------------ | ------------- | --------- |
| Firestore rules expired | error | CWE-284, A01:2021 | [Insecure rules](https://firebase.google.com/docs/firestore/security/insecure-rules) | [firestore-rules-expired.ts](rules/firestore-rules-expired.ts) |
| ID token cookie flags | error | CWE-1004, A02:2021 | [Manage cookies](https://firebase.google.com/docs/auth/admin/manage-cookies) | [id-token-cookie-flags.ts](rules/id-token-cookie-flags.ts) |
| Middleware token not verified | error | CWE-345, A07:2021 | [Verify session cookies](https://firebase.google.com/docs/auth/admin/manage-cookies#verify_session_cookies_and_check_permissions) | [middleware-token-not-verified.ts](rules/middleware-token-not-verified.ts) |
| Hardcoded user ID | error | CWE-284, A01:2021 | [Manage users](https://firebase.google.com/docs/auth/web/manage-users) | [hardcoded-user-id.ts](rules/hardcoded-user-id.ts) |
| auth/user-not-found disclosure | warning | CWE-204, A07:2021 | [Enumeration protection](https://firebase.google.com/docs/auth/web/password-auth#enumeration-protection) | [auth-user-not-found-disclosure.ts](rules/auth-user-not-found-disclosure.ts) |
| Missing App Check | warning | CWE-285, A04:2021 | [Launch checklist](https://firebase.google.com/docs/database/web/start) | [missing-app-check.ts](rules/missing-app-check.ts) |

### Correctness

| Rule | Severity | Firebase docs | Rule file |
| ---- | -------- | ------------- | --------- |
| Signup password confirm | warning | [Password auth](https://firebase.google.com/docs/auth/web/password-auth) | [signup-password-confirm.ts](rules/signup-password-confirm.ts) |
| Use arrayUnion/arrayRemove | warning | [Update array fields](https://firebase.google.com/docs/firestore/manage-data/add-data#update_elements_in_an_array) | [use-array-union-remove.ts](rules/use-array-union-remove.ts) |
| Duplicate initializeApp | warning | [Multi-project setup](https://firebase.google.com/docs/projects/multiprojects) | [duplicate-initialize-app.ts](rules/duplicate-initialize-app.ts) |
| Use Timestamp.now() | info | [Timestamp reference](https://firebase.google.com/docs/reference/js/firestore_.timestamp) | [use-timestamp-now.ts](rules/use-timestamp-now.ts) |
| Unhandled auth popup rejection | error | [Google sign-in](https://firebase.google.com/docs/auth/web/google-signin) | [unhandled-auth-popup-rejection.ts](rules/unhandled-auth-popup-rejection.ts) |
| RTDB list read for single item | warning | [Read and write data](https://firebase.google.com/docs/database/web/read-and-write) | [rtdb-list-read-for-single-item.ts](rules/rtdb-list-read-for-single-item.ts) |
| Unvalidated external data to RTDB | error | [Read and write data](https://firebase.google.com/docs/database/web/read-and-write) | [unvalidated-external-data-to-rtdb.ts](rules/unvalidated-external-data-to-rtdb.ts) |
| RTDB batch write not atomic | warning | [Read and write data](https://firebase.google.com/docs/database/web/read-and-write) | [rtdb-batch-write-not-atomic.ts](rules/rtdb-batch-write-not-atomic.ts) |

### Reliability

| Rule | Severity | Firebase docs | Rule file |
| ---- | -------- | ------------- | --------- |
| onSnapshot async throw | warning | [Handle listen errors](https://firebase.google.com/docs/firestore/query-data/listen#handle_listen_errors) | [onSnapshot-async-throw.ts](rules/onSnapshot-async-throw.ts) |
| onSnapshot missing error callback | warning | [Handle listen errors](https://firebase.google.com/docs/firestore/query-data/listen#handle_listen_errors) | [onSnapshot-missing-error-callback.ts](rules/onSnapshot-missing-error-callback.ts) |
| Firestore document size guard | warning | [Quotas and limits](https://firebase.google.com/docs/firestore/quotas#limits) | [firestore-document-size-guard.ts](rules/firestore-document-size-guard.ts) |
| RTDB listener error not handled | warning | [onValue](https://firebase.google.com/docs/reference/js/database.md#onvalue) | [rtdb-listener-error-not-handled.ts](rules/rtdb-listener-error-not-handled.ts) |
| Effect deps whole user object | warning | [onAuthStateChanged](https://firebase.google.com/docs/reference/js/auth.md#onauthstatechanged) | [effect-deps-whole-user-object.ts](rules/effect-deps-whole-user-object.ts) |
| RTDB write promise not handled | error | [Read and write data](https://firebase.google.com/docs/database/web/read-and-write) | [rtdb-write-promise-not-handled.ts](rules/rtdb-write-promise-not-handled.ts) |

---

## Test summary

| Category    | Rules | Test files | Fixture pairs |
| ----------- | ----- | ---------- | -------------- |
| Security    | 6     | 6          | 6              |
| Correctness | 8     | 8          | 8              |
| Reliability | 6     | 6          | 6              |
| **Total**   | **20** | **20**    | **20**         |

### Running tests

```bash
pnpm build
npx vitest run tests/rules/firebase-

# Single rule
npx vitest run tests/rules/firebase-firestore-rules-expired.test.ts

# Lint a fixture directory end-to-end
node dist/cli.mjs tests/fixtures/firebase/firebase-hardcoded-user-id-broken
```

## Known detection limits

Rules operate per-file on the modular SDK's free functions. A project that wraps SDK calls behind project-local helpers will hide the call shapes these rules look for. The `firebase-firestore-document-size-guard` rule detects `getJSON()` only when it appears directly inside `updateDoc`/`setDoc` arguments, not when the result is pre-assigned to a variable.

## Rules not implemented

- **`firebase/rtdb-rules-not-deployed-via-cli`** and **`firebase/hosting-missing-predeploy`** — both are `firebase.json` config checks. `src/scanner.ts` only walks `.ts/.tsx/.js/.jsx` files.
- **Finding L (users vs userCollections split)** — data-modeling decision, cannot be statically detected.
- **Finding N (N+1 getDoc pattern)** — `Promise.all(ids.map(getDoc))` is also the correct pattern; flagging it would false-positive.
