# Firebase

8 oxlint rules for the [Firebase](https://firebase.google.com) modular JS SDK (`firebase/app`, `firebase/auth`, `firebase/database`, `firebase/app-check`).


|                          |                                       |
| ------------------------ | ------------------------------------- |
| **Manifest**             | [manifest.ts](manifest.ts)            |
| **Rule implementations** | [rules/](rules/)                      |
| **Shared AST helpers**   | [utils.ts](utils.ts)                  |
| **Fixtures**              | `tests/fixtures/firebase/`            |
| **Rule tests**           | `tests/rules/firebase-*.test.ts`      |


Detection: `firebase` in package.json, `import from 'firebase/app'`/`firebase/auth'`/`'firebase/database'`/`'firebase/app-check'`, or `firebaseio.com`/`firebaseapp.com` in source.

Two related checks — RTDB security rules not version-controlled, and no predeploy hook configured — were intentionally left out: both are `firebase.json` config-file checks, not JS/TS AST patterns, and are out of scope for this oxlint-based plugin.

---

## Rules and tests by category

### Security

| Rule              | Severity | CWE / OWASP                 | Firebase docs                                                                      | Rule file                                        | Test                                                                              |
| ------------------ | -------- | ---------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Missing App Check | warning  | CWE-285, A04:2021 | [Launch checklist](https://firebase.google.com/docs/database/web/start)              | [missing-app-check.ts](rules/missing-app-check.ts) | [firebase-missing-app-check.test.ts](../../../tests/rules/firebase-missing-app-check.test.ts) |

#### Fixtures

| Rule               | Broken                                              | Fixed                                                                         |
| ------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------- |
| Missing App Check  | `firebase-missing-app-check-broken/01-firebase-init.js`, `02-renamed-imports.ts` | `firebase-missing-app-check-fixed/01-with-app-check.js`, `02-namespace-import.ts` (adversarial) |

---

### Correctness

| Rule                                  | Severity | Firebase docs                                                                       | Rule file                                                                          | Test                                                                                                       |
| -------------------------------------- | -------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Unhandled auth popup rejection         | error    | [Google sign-in](https://firebase.google.com/docs/auth/web/google-signin)               | [unhandled-auth-popup-rejection.ts](rules/unhandled-auth-popup-rejection.ts)            | [firebase-unhandled-auth-popup-rejection.test.ts](../../../tests/rules/firebase-unhandled-auth-popup-rejection.test.ts) |
| RTDB list read for single item         | warning  | [Read and write data](https://firebase.google.com/docs/database/web/read-and-write)     | [rtdb-list-read-for-single-item.ts](rules/rtdb-list-read-for-single-item.ts)            | [firebase-rtdb-list-read-for-single-item.test.ts](../../../tests/rules/firebase-rtdb-list-read-for-single-item.test.ts) |
| Unvalidated external data to RTDB      | error    | [Read and write data](https://firebase.google.com/docs/database/web/read-and-write)     | [unvalidated-external-data-to-rtdb.ts](rules/unvalidated-external-data-to-rtdb.ts)      | [firebase-unvalidated-external-data-to-rtdb.test.ts](../../../tests/rules/firebase-unvalidated-external-data-to-rtdb.test.ts) |
| RTDB batch write not atomic            | warning  | [Read and write data](https://firebase.google.com/docs/database/web/read-and-write)     | [rtdb-batch-write-not-atomic.ts](rules/rtdb-batch-write-not-atomic.ts)                  | [firebase-rtdb-batch-write-not-atomic.test.ts](../../../tests/rules/firebase-rtdb-batch-write-not-atomic.test.ts) |

#### Fixtures

| Rule                               | Broken                                                                                          | Fixed                                                                                                    |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Unhandled auth popup rejection      | `...-broken/01-login-page.jsx`, `02-then-no-catch.jsx`                                              | `...-fixed/01-try-catch-finally.jsx`, `02-then-catch-chain.jsx` (adversarial)                                  |
| RTDB list read for single item      | `...-broken/01-task-edit-page.jsx`, `02-item-detail-page.jsx`                                       | `...-fixed/01-single-node-subscribe.jsx`, `02-unrelated-find.jsx` (adversarial)                                |
| Unvalidated external data to RTDB   | `...-broken/01-parse-syllabus-and-write.js`, `02-fetch-json-update.ts`                              | `...-fixed/01-validated-before-write.js`, `02-parse-and-write-in-separate-functions.js` (adversarial)          |
| RTDB batch write not atomic         | `...-broken/01-add-tasks.js`, `02-inline-promise-all.ts`                                            | `...-fixed/01-atomic-update.js`, `02-promise-all-without-push.ts` (adversarial)                                |

---

### Reliability

| Rule                              | Severity | Firebase docs                                                                          | Rule file                                                                | Test                                                                                                |
| ----------------------------------- | -------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| RTDB listener error not handled    | warning  | [onValue](https://firebase.google.com/docs/reference/js/database.md#onvalue)               | [rtdb-listener-error-not-handled.ts](rules/rtdb-listener-error-not-handled.ts) | [firebase-rtdb-listener-error-not-handled.test.ts](../../../tests/rules/firebase-rtdb-listener-error-not-handled.test.ts) |
| Effect deps whole user object      | warning  | [onAuthStateChanged](https://firebase.google.com/docs/reference/js/auth.md#onauthstatechanged) | [effect-deps-whole-user-object.ts](rules/effect-deps-whole-user-object.ts)    | [firebase-effect-deps-whole-user-object.test.ts](../../../tests/rules/firebase-effect-deps-whole-user-object.test.ts) |
| RTDB write promise not handled     | error    | [Read and write data](https://firebase.google.com/docs/database/web/read-and-write)        | [rtdb-write-promise-not-handled.ts](rules/rtdb-write-promise-not-handled.ts)  | [firebase-rtdb-write-promise-not-handled.test.ts](../../../tests/rules/firebase-rtdb-write-promise-not-handled.test.ts) |

#### Fixtures

| Rule                            | Broken                                                                          | Fixed                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| RTDB listener error not handled  | `...-broken/01-dashboard-page.jsx`, `02-fatigue-subscribe.ts`                        | `...-fixed/01-error-callback.jsx`, `02-listen-options.ts` (adversarial)                         |
| Effect deps whole user object    | `...-broken/01-task-page.jsx`, `02-dashboard-page.jsx`                               | `...-fixed/01-uid-dependency.jsx`, `02-unrelated-user-dependency.jsx` (adversarial)              |
| RTDB write promise not handled   | `...-broken/01-fire-and-forget.jsx`, `02-handle-save-no-try-catch.jsx`                | `...-fixed/01-try-catch.jsx`, `02-passthrough-return.ts` (adversarial)                          |

---

## Test summary

| Category    | Rules | Test files | Fixture pairs |
| ----------- | ----- | ---------- | -------------- |
| Security    | 1     | 1          | 1              |
| Correctness | 4     | 4          | 4              |
| Reliability | 3     | 3          | 3              |
| **Total**   | **8** | **8**      | **8**          |

### Running tests

```bash
pnpm build
npx vitest run tests/rules/firebase-

# Single rule
npx vitest run tests/rules/firebase-missing-app-check.test.ts

# Lint a fixture directory end-to-end
node dist/cli.mjs tests/fixtures/firebase/firebase-missing-app-check-broken
```

## Known detection limits

These rules operate per-file on the modular SDK's free functions (`onValue`, `set`, `update`, `push`, `signInWithPopup`, ...) rather than on project-specific wrapper names, so they generalize across different Firebase codebases. The tradeoff: a project that wraps every RTDB write/listen call in its own helper module (e.g. `addTask()` calling `set()` in one file, called from a different file) hides the call shape these rules look for — `rtdb-listener-error-not-handled`, `rtdb-write-promise-not-handled`, and `unvalidated-external-data-to-rtdb` won't fire when the relevant SDK call is one file removed behind a project-local wrapper function, since that's a cross-file data/control-flow trace a single-file oxlint rule can't perform.

## Rules not implemented

- **`firebase/rtdb-rules-not-deployed-via-cli`** and **`firebase/hosting-missing-predeploy`** — both are `firebase.json` config checks. `src/scanner.ts` only walks and lints `.ts/.tsx/.js/.jsx` files; extending it to read JSON config is out of scope for this rule pack.
