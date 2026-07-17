# Firebase

19 oxlint rules for the [Firebase](https://firebase.google.com) modular JS SDK (`firebase/app`, `firebase/auth`, `firebase/firestore`, `firebase/database`, `firebase/app-check`, `firebase-admin`).


|                          |                                  |
| ------------------------ | -------------------------------- |
| **Manifest**             | [manifest.ts](manifest.ts)       |
| **Rule implementations** | [rules/](rules/)                 |
| **Shared AST helpers**   | [utils.ts](utils.ts)             |
| **Fixtures**             | `tests/fixtures/firebase/`       |
| **Rule tests**           | `tests/rules/firebase-*.test.ts` |


Detection: `firebase` in package.json, `import from 'firebase/app'`/`'firebase/auth'`/`'firebase/database'`/`'firebase/app-check'`, or `firebaseio.com`/`firebaseapp.com` in source.

---



## Rules and tests by category



### Security

Auth security (credential handling, token verification, session cookies), Firestore rule validation, and user enumeration protection.


| Rule                           | Severity | CWE / OWASP        | Why it matters | Firebase docs                                                                                                                     | Rule file                                                                    | Test                                                                         |
| ------------------------------ | -------- | ------------------ | --- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Firestore rules expired        | error    | CWE-284, A01:2021  | Hard-coded expiry date has passed; all client reads and writes are now permanently denied by the security rules. | [Insecure rules](https://firebase.google.com/docs/firestore/security/insecure-rules)                                              | [firestore-rules-expired.ts](rules/firestore-rules-expired.ts)               | [test](../../../tests/rules/firebase-firestore-rules-expired.test.ts)        |
| ID token cookie flags          | error    | CWE-1004, A05:2021 | Firebase ID tokens expire after 1 hour, but the cookie is set for 24 hours and lacks the httpOnly flag, exposing it to XSS attacks. | [Manage cookies](https://firebase.google.com/docs/auth/admin/manage-cookies)                                                      | [id-token-cookie-flags.ts](rules/id-token-cookie-flags.ts)                   | [test](../../../tests/rules/firebase-id-token-cookie-flags.test.ts)          |
| Hardcoded user ID              | error    | CWE-284, A01:2021  | User ID is hardcoded as "demoUser123", causing all users to share the same Firestore document and overwrite each other's data. | [Manage users](https://firebase.google.com/docs/auth/web/manage-users)                                                            | [hardcoded-user-id.ts](rules/hardcoded-user-id.ts)                           | [test](../../../tests/rules/firebase-hardcoded-user-id.test.ts)              |
| auth/user-not-found disclosure | warning  | CWE-204, A07:2021  | Displaying a distinct message for unknown emails enables email enumeration attacks; Firebase's enumeration protection makes this code path dead. | [Enumeration protection](https://firebase.google.com/docs/auth/web/password-auth#enumeration-protection)                          | [auth-user-not-found-disclosure.ts](rules/auth-user-not-found-disclosure.ts) | [test](../../../tests/rules/firebase-auth-user-not-found-disclosure.test.ts) |
| Missing App Check              | warning  | CWE-285, A04:2021  | Without App Check (configured *and* enforced in the console), any client presenting the public project config can reach Firebase backends, gated only by Security Rules. | [App Check for web](https://firebase.google.com/docs/app-check/web/recaptcha-provider)                                            | [missing-app-check.ts](rules/missing-app-check.ts)                           | [test](../../../tests/rules/firebase-missing-app-check.test.ts)              |




#### Security fixtures


| Rule                           | Broken (`should flag`)                                       | Fixed (`should not flag`)                                    |
| ------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------ |
| Firestore rules expired        | `firestore-rules-string-broken.ts`, `deploy-rules-broken.ts` | `rules-string-fixed.ts`, `future-date-adversarial.ts`        |
| ID token cookie flags          | `auth-page-broken.tsx`, `signin-broken.tsx`, `js-cookie-broken.ts` | `auth-page-fixed.tsx`, `non-token-cookie-adversarial.tsx`    |
| Hardcoded user ID              | `providers-broken.tsx`, `settings-broken.ts`                 | `providers-fixed.tsx`, `env-user-adversarial.tsx`            |
| auth/user-not-found disclosure | `forgot-password-broken.tsx`, `login-broken.ts`              | `forgot-password-fixed.tsx`, `logging-only-adversarial.tsx`  |
| Missing App Check              | [existing fixtures]                                          | [existing fixtures]                                          |


---



### Correctness

Data consistency, validation, and transaction atomicity (array mutations, timestamps, password confirmation, duplicate initialization).


| Rule                              | Severity | Why it matters | Firebase docs                                                                                                      | Rule file                                                                          | Test                                                                            |
| --------------------------------- | -------- | --- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Signup password confirm           | warning  | Sign-up form has a confirmPassword field but never validates it matches the password before creating the account. | [Password auth](https://firebase.google.com/docs/auth/web/password-auth)                                           | [signup-password-confirm.ts](rules/signup-password-confirm.ts)                     | [test](../../../tests/rules/firebase-signup-password-confirm.test.ts)           |
| Use arrayUnion/arrayRemove        | warning  | Array mutations use read-modify-write instead of atomic arrayUnion/arrayRemove, losing concurrent updates. | [Update array fields](https://firebase.google.com/docs/firestore/manage-data/add-data#update_elements_in_an_array) | [use-array-union-remove.ts](rules/use-array-union-remove.ts)                       | [test](../../../tests/rules/firebase-use-array-union-remove.test.ts)            |
| Duplicate initializeApp           | warning  | Two files independently call initializeApp without checking getApps(), creating a trap for the duplicate-app error. | [Multi-project setup](https://firebase.google.com/docs/projects/multiprojects)                                     | [duplicate-initialize-app.ts](rules/duplicate-initialize-app.ts)                   | [test](../../../tests/rules/firebase-duplicate-initialize-app.test.ts)          |
| Use serverTimestamp()             | info     | new Date() (like Timestamp.now()) relies on the untrusted client clock, and fails security rules that compare a field against request.time — serverTimestamp() is server-authoritative. | [Timestamp reference](https://firebase.google.com/docs/reference/js/firestore_.timestamp)                          | [use-timestamp-now.ts](rules/use-timestamp-now.ts)                                 | [test](../../../tests/rules/firebase-use-timestamp-now.test.ts)                 |
| Unhandled auth popup rejection    | error    | auth popup rejection is not handled, leaving the UI in an indeterminate state with no error feedback. | [Google sign-in](https://firebase.google.com/docs/auth/web/google-signin)                                          | [unhandled-auth-popup-rejection.ts](rules/unhandled-auth-popup-rejection.ts)       | [test](../../../tests/rules/firebase-unhandled-auth-popup-rejection.test.ts)    |
| RTDB list read for single item    | warning  | Querying with limitToFirst(1) on a path with 1000 items returns the wrong item and wastes bandwidth. | [Read and write data](https://firebase.google.com/docs/database/web/read-and-write)                                | [rtdb-list-read-for-single-item.ts](rules/rtdb-list-read-for-single-item.ts)       | [test](../../../tests/rules/firebase-rtdb-list-read-for-single-item.test.ts)    |
| Unvalidated external data to RTDB | error    | External data is written directly to RTDB without validation, allowing clients to corrupt the data structure. | [Read and write data](https://firebase.google.com/docs/database/web/read-and-write)                                | [unvalidated-external-data-to-rtdb.ts](rules/unvalidated-external-data-to-rtdb.ts) | [test](../../../tests/rules/firebase-unvalidated-external-data-to-rtdb.test.ts) |
| RTDB batch write not atomic       | warning  | Multiple set() calls are not atomic; concurrent writes can interleave, leaving the database in an inconsistent state. | [Transactions](https://firebase.google.com/docs/database/web/read-and-write)                                       | [rtdb-batch-write-not-atomic.ts](rules/rtdb-batch-write-not-atomic.ts)             | [test](../../../tests/rules/firebase-rtdb-batch-write-not-atomic.test.ts)       |




#### Correctness fixtures


| Rule                              | Broken (`should flag`)                           | Fixed (`should not flag`)                              |
| --------------------------------- | ------------------------------------------------ | ------------------------------------------------------ |
| Signup password confirm           | `signup-broken.tsx`, `register-broken.tsx`       | `signup-fixed.tsx`, `no-confirm-field-adversarial.tsx` |
| Use arrayUnion/arrayRemove        | `sidebar-broken.tsx`, `document-list-broken.tsx` | `sidebar-fixed.tsx`, `set-doc-adversarial.tsx`         |
| Duplicate initializeApp           | `firebase-broken.ts`, `firebase-admin-broken.ts` | `firebase-fixed.ts`, `firebase-guarded-adversarial.ts` |
| Use serverTimestamp()             | `sidebar-broken.tsx`, `auth-broken.tsx`          | `sidebar-fixed.tsx`, `date-display-adversarial.tsx`    |
| Unhandled auth popup rejection    | [existing fixtures]                              | [existing fixtures]                                    |
| RTDB list read for single item    | [existing fixtures]                              | [existing fixtures]                                    |
| Unvalidated external data to RTDB | [existing fixtures]                              | [existing fixtures]                                    |
| RTDB batch write not atomic       | [existing fixtures]                              | [existing fixtures]                                    |


---



### Reliability

Listener error handling (Firestore and RTDB), document size limits, effect dependencies, and promise rejection handling.


| Rule                              | Severity | Why it matters | Firebase docs                                                                                             | Rule file                                                                          | Test                                                                            |
| --------------------------------- | -------- | --- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| onSnapshot async throw            | warning  | throw inside an async onSnapshot callback becomes an unhandled promise rejection — the error reaches neither the UI nor the onSnapshot error callback (which only fires for stream errors). | [Handle listen errors](https://firebase.google.com/docs/firestore/query-data/listen#handle_listen_errors) | [onSnapshot-async-throw.ts](rules/onSnapshot-async-throw.ts)                       | [test](../../../tests/rules/firebase-onSnapshot-async-throw.test.ts)            |
| onSnapshot missing error callback | warning  | Missing error callback means Firestore permission errors are silently swallowed, leaving the UI in an indeterminate state with no error indication. | [Handle listen errors](https://firebase.google.com/docs/firestore/query-data/listen#handle_listen_errors) | [onSnapshot-missing-error-callback.ts](rules/onSnapshot-missing-error-callback.ts) | [test](../../../tests/rules/firebase-onSnapshot-missing-error-callback.test.ts) |
| Firestore document size guard     | warning  | No size guard for documents; base64-encoded images silently hit the 1 MiB limit, causing failed writes with no error indication. | [Quotas and limits](https://firebase.google.com/docs/firestore/quotas#limits)                             | [firestore-document-size-guard.ts](rules/firestore-document-size-guard.ts)         | [test](../../../tests/rules/firebase-firestore-document-size-guard.test.ts)     |
| RTDB listener error not handled   | warning  | RTDB listener errors are not handled, leaving the UI unaware that the connection is broken or permission denied. | [onValue](https://firebase.google.com/docs/reference/js/database.md#onvalue)                              | [rtdb-listener-error-not-handled.ts](rules/rtdb-listener-error-not-handled.ts)     | [test](../../../tests/rules/firebase-rtdb-listener-error-not-handled.test.ts)   |
| Effect deps whole user object     | warning  | Depending on the entire user object causes useEffect to re-run on every property change, even when unrelated to the data dependency. | [onAuthStateChanged](https://firebase.google.com/docs/reference/js/auth.md#onauthstatechanged)            | [effect-deps-whole-user-object.ts](rules/effect-deps-whole-user-object.ts)         | [test](../../../tests/rules/firebase-effect-deps-whole-user-object.test.ts)     |
| RTDB write promise not handled    | warning  | RTDB write promise is not awaited or caught, leaving the code unaware if the write succeeded or failed, and silently skipping error recovery. | [Read and write data](https://firebase.google.com/docs/database/web/read-and-write)                       | [rtdb-write-promise-not-handled.ts](rules/rtdb-write-promise-not-handled.ts)       | [test](../../../tests/rules/firebase-rtdb-write-promise-not-handled.test.ts)    |




#### Reliability fixtures


| Rule                              | Broken (`should flag`)                               | Fixed (`should not flag`)                                    |
| --------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------ |
| onSnapshot async throw            | `advanced-editor-broken.tsx`, `listener-broken.ts`   | `advanced-editor-fixed.tsx`, `sync-callback-adversarial.tsx` |
| onSnapshot missing error callback | `editor-broken.tsx`, `listener-broken.ts`            | `editor-fixed.tsx`, `with-options-adversarial.tsx`           |
| Firestore document size guard     | `editor-save-broken.ts`, `debounced-save-broken.tsx` | `editor-save-fixed.ts`, `text-only-save-adversarial.ts`      |
| RTDB listener error not handled   | [existing fixtures]                                  | [existing fixtures]                                          |
| Effect deps whole user object     | [existing fixtures]                                  | [existing fixtures]                                          |
| RTDB write promise not handled    | [existing fixtures]                                  | [existing fixtures]                                          |


---



## Test summary


| Category    | Rules  | Test files | Fixture pairs |
| ----------- | ------ | ---------- | ------------- |
| Security    | 5      | 5          | 5             |
| Correctness | 8      | 8          | 8             |
| Reliability | 6      | 6          | 6             |
| **Total**   | **19** | **19**     | **19**        |


## Known detection limits

Rules operate per-file on the modular SDK's free functions. A project that wraps SDK calls behind project-local helpers will hide the call shapes these rules look for. The `firebase-firestore-document-size-guard` rule detects `getJSON()` only when it appears directly inside `updateDoc`/`setDoc` arguments, not when the result is pre-assigned to a variable. `firebase-rtdb-write-promise-not-handled` analyzes one file at a time, so `await set(...)` inside a helper whose *callers* wrap it in try/catch is still flagged — hence warning severity. `firebase-firestore-rules-expired` only sees rules embedded in JS/TS string literals; a real `firestore.rules` file is outside the scanner's file set.

## Rules not implemented

- `firebase/rtdb-rules-not-deployed-via-cli` and `firebase/hosting-missing-predeploy` — both are `firebase.json` config checks. `src/scanner.ts` only walks `.ts/.tsx/.js/.jsx` files.
- **Finding L (users vs userCollections split)** — data-modeling decision, cannot be statically detected.
- **Finding N (N+1 getDoc pattern)** — `Promise.all(ids.map(getDoc))` is also the correct pattern; flagging it would false-positive.

## Rules removed

- `firebase-middleware-token-not-verified` — removed July 2026. Next.js deprecated `middleware.ts` (renamed to `proxy.ts` in Next 16) and explicitly discourages doing authentication there; the recommended pattern is verifying the session in route handlers / server components (the data layer), where `firebase-admin` actually runs. The rule also matched any `.get('…token…')` call in any file, producing false positives on non-cookie reads.

