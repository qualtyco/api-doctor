# Firebase

20 oxlint rules for the [Firebase](https://firebase.google.com) modular JS SDK (`firebase/app`, `firebase/auth`, `firebase/firestore`, `firebase/database`, `firebase/app-check`, `firebase-admin`).


|                          |                                       |
| ------------------------ | ------------------------------------- |
| **Manifest**             | [manifest.ts](manifest.ts)            |
| **Rule implementations** | [rules/](rules/)                      |
| **Shared AST helpers**   | [utils.ts](utils.ts)                  |
| **Fixtures**             | `tests/fixtures/firebase/`            |
| **Rule tests**           | `tests/rules/firebase-*.test.ts`      |


Detection: `firebase` in package.json, `import from 'firebase/app'`/`'firebase/auth'`/`'firebase/database'`/`'firebase/app-check'`, or `firebaseio.com`/`firebaseapp.com` in source.

---

## Rules and tests by category

### Security

Auth security (credential handling, token verification, session cookies), Firestore rule validation, and user enumeration protection.

| Rule | Severity | CWE / OWASP | Firebase docs | Rule file | Test |
| ---- | -------- | ----------- | ------------- | --------- | ---- |
| Firestore rules expired | error | CWE-284, A01:2021 | [Insecure rules](https://firebase.google.com/docs/firestore/security/insecure-rules) | [firestore-rules-expired.ts](rules/firestore-rules-expired.ts) | [test](../../../tests/rules/firebase-firestore-rules-expired.test.ts) |
| ID token cookie flags | error | CWE-1004, A02:2021 | [Manage cookies](https://firebase.google.com/docs/auth/admin/manage-cookies) | [id-token-cookie-flags.ts](rules/id-token-cookie-flags.ts) | [test](../../../tests/rules/firebase-id-token-cookie-flags.test.ts) |
| Middleware token not verified | error | CWE-345, A07:2021 | [Verify session cookies](https://firebase.google.com/docs/auth/admin/manage-cookies#verify_session_cookies_and_check_permissions) | [middleware-token-not-verified.ts](rules/middleware-token-not-verified.ts) | [test](../../../tests/rules/firebase-middleware-token-not-verified.test.ts) |
| Hardcoded user ID | error | CWE-284, A01:2021 | [Manage users](https://firebase.google.com/docs/auth/web/manage-users) | [hardcoded-user-id.ts](rules/hardcoded-user-id.ts) | [test](../../../tests/rules/firebase-hardcoded-user-id.test.ts) |
| auth/user-not-found disclosure | warning | CWE-204, A07:2021 | [Enumeration protection](https://firebase.google.com/docs/auth/web/password-auth#enumeration-protection) | [auth-user-not-found-disclosure.ts](rules/auth-user-not-found-disclosure.ts) | [test](../../../tests/rules/firebase-auth-user-not-found-disclosure.test.ts) |
| Missing App Check | warning | CWE-285, A04:2021 | [Launch checklist](https://firebase.google.com/docs/database/web/start) | [missing-app-check.ts](rules/missing-app-check.ts) | [test](../../../tests/rules/firebase-missing-app-check.test.ts) |

#### Security fixtures

| Rule | Broken (`should flag`) | Fixed (`should not flag`) |
| ---- | ---------------------- | ------------------------- |
| Firestore rules expired | `firestore-rules-string-broken.ts`, `deploy-rules-broken.ts` | `rules-string-fixed.ts`, `future-date-adversarial.ts` |
| ID token cookie flags | `auth-page-broken.tsx`, `signin-broken.tsx` | `auth-page-fixed.tsx`, `non-token-cookie-adversarial.tsx` |
| Middleware token not verified | `middleware-broken.ts`, `middleware-presence-only-broken.ts` | `middleware-fixed.ts`, `middleware-no-cookie-adversarial.ts` |
| Hardcoded user ID | `providers-broken.tsx`, `settings-broken.ts` | `providers-fixed.tsx`, `env-user-adversarial.tsx` |
| auth/user-not-found disclosure | `forgot-password-broken.tsx`, `login-broken.ts` | `forgot-password-fixed.tsx`, `logging-only-adversarial.tsx` |
| Missing App Check | [existing fixtures] | [existing fixtures] |

---

### Correctness

Data consistency, validation, and transaction atomicity (array mutations, timestamps, password confirmation, duplicate initialization).

| Rule | Severity | Firebase docs | Rule file | Test |
| ---- | -------- | ------------- | --------- | ---- |
| Signup password confirm | warning | [Password auth](https://firebase.google.com/docs/auth/web/password-auth) | [signup-password-confirm.ts](rules/signup-password-confirm.ts) | [test](../../../tests/rules/firebase-signup-password-confirm.test.ts) |
| Use arrayUnion/arrayRemove | warning | [Update array fields](https://firebase.google.com/docs/firestore/manage-data/add-data#update_elements_in_an_array) | [use-array-union-remove.ts](rules/use-array-union-remove.ts) | [test](../../../tests/rules/firebase-use-array-union-remove.test.ts) |
| Duplicate initializeApp | warning | [Multi-project setup](https://firebase.google.com/docs/projects/multiprojects) | [duplicate-initialize-app.ts](rules/duplicate-initialize-app.ts) | [test](../../../tests/rules/firebase-duplicate-initialize-app.test.ts) |
| Use Timestamp.now() | info | [Timestamp reference](https://firebase.google.com/docs/reference/js/firestore_.timestamp) | [use-timestamp-now.ts](rules/use-timestamp-now.ts) | [test](../../../tests/rules/firebase-use-timestamp-now.test.ts) |
| Unhandled auth popup rejection | error | [Google sign-in](https://firebase.google.com/docs/auth/web/google-signin) | [unhandled-auth-popup-rejection.ts](rules/unhandled-auth-popup-rejection.ts) | [test](../../../tests/rules/firebase-unhandled-auth-popup-rejection.test.ts) |
| RTDB list read for single item | warning | [Read and write data](https://firebase.google.com/docs/database/web/read-and-write) | [rtdb-list-read-for-single-item.ts](rules/rtdb-list-read-for-single-item.ts) | [test](../../../tests/rules/firebase-rtdb-list-read-for-single-item.test.ts) |
| Unvalidated external data to RTDB | error | [Read and write data](https://firebase.google.com/docs/database/web/read-and-write) | [unvalidated-external-data-to-rtdb.ts](rules/unvalidated-external-data-to-rtdb.ts) | [test](../../../tests/rules/firebase-unvalidated-external-data-to-rtdb.test.ts) |
| RTDB batch write not atomic | warning | [Transactions](https://firebase.google.com/docs/database/web/read-and-write) | [rtdb-batch-write-not-atomic.ts](rules/rtdb-batch-write-not-atomic.ts) | [test](../../../tests/rules/firebase-rtdb-batch-write-not-atomic.test.ts) |

#### Correctness fixtures

| Rule | Broken (`should flag`) | Fixed (`should not flag`) |
| ---- | ---------------------- | ------------------------- |
| Signup password confirm | `signup-broken.tsx`, `register-broken.tsx` | `signup-fixed.tsx`, `no-confirm-field-adversarial.tsx` |
| Use arrayUnion/arrayRemove | `sidebar-broken.tsx`, `document-list-broken.tsx` | `sidebar-fixed.tsx`, `set-doc-adversarial.tsx` |
| Duplicate initializeApp | `firebase-broken.ts`, `firebase-admin-broken.ts` | `firebase-fixed.ts`, `firebase-guarded-adversarial.ts` |
| Use Timestamp.now() | `sidebar-broken.tsx`, `auth-broken.tsx` | `sidebar-fixed.tsx`, `date-display-adversarial.tsx` |
| Unhandled auth popup rejection | [existing fixtures] | [existing fixtures] |
| RTDB list read for single item | [existing fixtures] | [existing fixtures] |
| Unvalidated external data to RTDB | [existing fixtures] | [existing fixtures] |
| RTDB batch write not atomic | [existing fixtures] | [existing fixtures] |

---

### Reliability

Listener error handling (Firestore and RTDB), document size limits, effect dependencies, and promise rejection handling.

| Rule | Severity | Firebase docs | Rule file | Test |
| ---- | -------- | ------------- | --------- | ---- |
| onSnapshot async throw | warning | [Handle listen errors](https://firebase.google.com/docs/firestore/query-data/listen#handle_listen_errors) | [onSnapshot-async-throw.ts](rules/onSnapshot-async-throw.ts) | [test](../../../tests/rules/firebase-onSnapshot-async-throw.test.ts) |
| onSnapshot missing error callback | warning | [Handle listen errors](https://firebase.google.com/docs/firestore/query-data/listen#handle_listen_errors) | [onSnapshot-missing-error-callback.ts](rules/onSnapshot-missing-error-callback.ts) | [test](../../../tests/rules/firebase-onSnapshot-missing-error-callback.test.ts) |
| Firestore document size guard | warning | [Quotas and limits](https://firebase.google.com/docs/firestore/quotas#limits) | [firestore-document-size-guard.ts](rules/firestore-document-size-guard.ts) | [test](../../../tests/rules/firebase-firestore-document-size-guard.test.ts) |
| RTDB listener error not handled | warning | [onValue](https://firebase.google.com/docs/reference/js/database.md#onvalue) | [rtdb-listener-error-not-handled.ts](rules/rtdb-listener-error-not-handled.ts) | [test](../../../tests/rules/firebase-rtdb-listener-error-not-handled.test.ts) |
| Effect deps whole user object | warning | [onAuthStateChanged](https://firebase.google.com/docs/reference/js/auth.md#onauthstatechanged) | [effect-deps-whole-user-object.ts](rules/effect-deps-whole-user-object.ts) | [test](../../../tests/rules/firebase-effect-deps-whole-user-object.test.ts) |
| RTDB write promise not handled | error | [Read and write data](https://firebase.google.com/docs/database/web/read-and-write) | [rtdb-write-promise-not-handled.ts](rules/rtdb-write-promise-not-handled.ts) | [test](../../../tests/rules/firebase-rtdb-write-promise-not-handled.test.ts) |

#### Reliability fixtures

| Rule | Broken (`should flag`) | Fixed (`should not flag`) |
| ---- | ---------------------- | ------------------------- |
| onSnapshot async throw | `advanced-editor-broken.tsx`, `listener-broken.ts` | `advanced-editor-fixed.tsx`, `sync-callback-adversarial.tsx` |
| onSnapshot missing error callback | `editor-broken.tsx`, `listener-broken.ts` | `editor-fixed.tsx`, `with-options-adversarial.tsx` |
| Firestore document size guard | `editor-save-broken.ts`, `debounced-save-broken.tsx` | `editor-save-fixed.ts`, `text-only-save-adversarial.ts` |
| RTDB listener error not handled | [existing fixtures] | [existing fixtures] |
| Effect deps whole user object | [existing fixtures] | [existing fixtures] |
| RTDB write promise not handled | [existing fixtures] | [existing fixtures] |

---

## Test summary

| Category    | Rules | Test files | Fixture pairs |
| ----------- | ----- | ---------- | -------------- |
| Security    | 6     | 6          | 6              |
| Correctness | 8     | 8          | 8              |
| Reliability | 6     | 6          | 6              |
| **Total**   | **20** | **20**     | **20**         |

### Running tests

```bash
# All Firebase rule tests
pnpm build
npx vitest run tests/rules/firebase-

# Single rule
npx vitest run tests/rules/firebase-firestore-rules-expired.test.ts

# Lint a fixture directory end-to-end
node dist/cli.mjs tests/fixtures/firebase/firebase-hardcoded-user-id-broken
```

### Test harness

Rule tests use [tests/helpers/lint-rule.ts](../../../tests/helpers/lint-rule.ts):

- `fixtureDir(ruleKey, 'broken' | 'fixed', 'firebase')` — resolves `tests/fixtures/firebase/<rule-key>-<kind>/`
- `lintFileForRule(ruleKey, filePath)` — runs oxlint with only that rule enabled

---

## Severity in reports

| Severity | Count | Affects score |
| -------- | ----- | ------------- |
| error    | 5     | −15 each      |
| warning  | 13    | −5 each       |
| info     | 2     | no penalty    |

Structured reports include each rule's `meta.docs.rationale` under **Why this matters** (markdown export).

---

## Known detection limits

Rules operate per-file on the modular SDK's free functions. A project that wraps SDK calls behind project-local helpers will hide the call shapes these rules look for. The `firebase-firestore-document-size-guard` rule detects `getJSON()` only when it appears directly inside `updateDoc`/`setDoc` arguments, not when the result is pre-assigned to a variable.

## Rules not implemented

- **`firebase/rtdb-rules-not-deployed-via-cli`** and **`firebase/hosting-missing-predeploy`** — both are `firebase.json` config checks. `src/scanner.ts` only walks `.ts/.tsx/.js/.jsx` files.
- **Finding L (users vs userCollections split)** — data-modeling decision, cannot be statically detected.
- **Finding N (N+1 getDoc pattern)** — `Promise.all(ids.map(getDoc))` is also the correct pattern; flagging it would false-positive.
