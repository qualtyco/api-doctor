# Resend

13 oxlint rules for the [Resend](https://resend.com) email API and Node.js SDK.


|                          |                                      |
| ------------------------ | ------------------------------------ |
| **Manifest**             | [manifest.ts](manifest.ts)           |
| **Rule implementations** | [rules/](rules/)                     |
| **Shared AST helpers**   | [utils.ts](utils.ts)                 |
| **Fixtures**             | `tests/fixtures/resend/`             |
| **Rule tests**           | `tests/rules/resend-*.test.ts`       |


Detection: `resend` in package.json, `import from 'resend'`, or `api.resend.com` in source.

---

## Rules and tests by category

### Security

Hard-coded credentials, client-bundle exposure, and unverified webhook payloads.


| Rule                      | Severity | CWE / OWASP        | Resend docs                                                                                            | Rule file                                                                            | Test                                                                                                    |
| ------------------------- | -------- | ------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Webhook signature missing | error    | CWE-345, API2:2023 | [Verify signatures](https://resend.com/docs/dashboard/webhooks/introduction#verify-webhook-signatures) | [webhook-signature.ts](rules/webhook-signature.ts)               | [resend-webhook-signature.test.ts](../../../tests/resend-webhook-signature.test.ts)                     |
| API key hardcoded         | error    | CWE-798, API8:2023 | [Prerequisites](https://resend.com/docs/send-with-nextjs#prerequisites)                                | [api-key-hardcoded.ts](rules/api-key-hardcoded.ts)               | [resend-api-key-hardcoded.test.ts](../../../tests/rules/resend-api-key-hardcoded.test.ts)               |
| API key in client bundle  | error    | CWE-200, API8:2023 | [Send with Next.js](https://resend.com/docs/send-with-nextjs)                                          | [api-key-in-client-bundle.ts](rules/api-key-in-client-bundle.ts) | [resend-api-key-in-client-bundle.test.ts](../../../tests/rules/resend-api-key-in-client-bundle.test.ts) |


**Industry references:** [OWASP API Security Top 10](https://owasp.org/API-Security/editions/2023/en/0x11-t10/), [CWE Top 25](https://cwe.mitre.org/top25/), [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org)

#### Fixtures


| Rule                     | Broken (`should flag`)                                                                                                         | Fixed (`should not flag`)                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Webhook signature        | `tests/fixtures/webhook-signature/resend-broken-no-verify.ts`, `resend-broken-late-verify.ts`, `resend-broken-comment-only.ts` | `resend-ok-verify-first.ts`, `resend-ok-renamed-import.ts`, `resend-ok-string-literal.ts`, `resend-ok-non-resend-webhook.ts` |
| API key hardcoded        | `resend-api-key-hardcoded-broken/01-literal-in-client-init.ts`, `02-literal-in-config-object.ts`                               | `resend-api-key-hardcoded-fixed/01-env-var.ts`, `02-adversarial-comment-and-substring.ts`                                    |
| API key in client bundle | `resend-api-key-in-client-bundle-broken/01-use-client-directive.tsx`, `components/Newsletter.tsx`                              | `resend-api-key-in-client-bundle-fixed/01-server-route.ts`, `components/EmailPreview.tsx`                                    |


**Scanner integration:** `tests/scanner.test.ts` runs the full pipeline against `tests/fixtures/webhook-signature/`.

---

### Correctness

Wrong API choice for marketing, compliance gaps, and test-only sender domains in production paths.


| Rule                           | Severity | Resend docs                                                                           | Rule file                                                                                        | Test                                                                                                                |
| ------------------------------ | -------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Marketing via batch send       | error    | [Batch sending — when to use](https://resend.com/docs/dashboard/emails/batch-sending) | [marketing-via-batch-send.ts](rules/marketing-via-batch-send.ts)             | [resend-marketing-via-batch-send.test.ts](../../../tests/rules/resend-marketing-via-batch-send.test.ts)             |
| Marketing missing unsubscribe  | error    | [Broadcasts](https://resend.com/docs/dashboard/broadcasts/introduction)               | [marketing-missing-unsubscribe.ts](rules/marketing-missing-unsubscribe.ts)   | [resend-marketing-missing-unsubscribe.test.ts](../../../tests/rules/resend-marketing-missing-unsubscribe.test.ts)   |
| Test domain in production path | warning  | [Send with Next.js](https://resend.com/docs/send-with-nextjs)                         | [test-domain-in-production-path.ts](rules/test-domain-in-production-path.ts) | [resend-test-domain-in-production-path.test.ts](../../../tests/rules/resend-test-domain-in-production-path.test.ts) |


#### Fixtures


| Rule                          | Broken                                                                                                | Fixed                                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Marketing via batch send      | `batch-send-broken/campaign/route.ts`, `newsletter-blast.ts`                                          | `batch-send-fixed/campaign-via-broadcasts.ts`, `order-receipts.ts`                                      |
| Marketing missing unsubscribe | `resend-marketing-missing-unsubscribe-broken/01-emails-send-no-unsub.ts`, `02-batch-send-no-unsub.ts` | `resend-marketing-missing-unsubscribe-fixed/01-marketing-with-unsub.ts`, `02-transactional-no-unsub.ts` |
| Test domain in production     | `resend-test-domain-in-production-path-broken/01-direct-literal.ts`, `02-env-fallback.ts`             | `resend-test-domain-in-production-path-fixed/01-verified-domain.ts`, `02-send.test.ts`                  |


---

### Reliability

Idempotency, batch limits, error mapping, and webhook retry safety.


| Rule                    | Severity | Resend docs                                                                            | Rule file                                                                          | Test                                                                                                  |
| ----------------------- | -------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Missing idempotency key | warning  | [Idempotency](https://resend.com/docs/send-with-nextjs)                                | [missing-idempotency-key.ts](rules/missing-idempotency-key.ts) | [resend-missing-idempotency-key.test.ts](../../../tests/rules/resend-missing-idempotency-key.test.ts) |
| Batch size not enforced | warning  | [Send batch (max 100)](https://resend.com/docs/api-reference/emails/send-batch-emails) | [batch-size-not-enforced.ts](rules/batch-size-not-enforced.ts) | [resend-batch-size-not-enforced.test.ts](../../../tests/rules/resend-batch-size-not-enforced.test.ts) |
| No error code mapping   | warning  | [AI onboarding — errors](https://resend.com/docs/ai-onboarding)                        | [no-error-code-mapping.ts](rules/no-error-code-mapping.ts)     | [resend-no-error-code-mapping.test.ts](../../../tests/rules/resend-no-error-code-mapping.test.ts)     |
| Webhook no idempotency  | warning  | [Webhooks](https://resend.com/docs/dashboard/webhooks/introduction)                    | [webhook-no-idempotency.ts](rules/webhook-no-idempotency.ts)   | [resend-webhook-no-idempotency.test.ts](../../../tests/rules/resend-webhook-no-idempotency.test.ts)   |


#### Fixtures


| Rule                    | Broken                                                                                   | Fixed                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Missing idempotency key | `resend-missing-idempotency-key-broken/01-emails-send.ts`, `02-batch-send.ts`            | `resend-missing-idempotency-key-fixed/01-key-in-payload.ts`, `02-key-in-options-arg.ts` |
| Batch size not enforced | `resend-batch-size-not-enforced-broken/01-direct-request-array.ts`, `02-mapped-array.ts` | `resend-batch-size-not-enforced-fixed/01-length-guarded.ts`, `02-chunked-loop.ts`       |
| No error code mapping   | `resend-no-error-code-mapping-broken/01-nextresponse-500.ts`, `02-res-status-500.ts`     | `resend-no-error-code-mapping-fixed/01-mapped-status.ts`, `02-non-resend-500.ts`        |
| Webhook no idempotency  | `resend-webhook-no-idempotency-broken/01-no-dedup.ts`, `02-switch-no-dedup.ts`           | `resend-webhook-no-idempotency-fixed/01-set-dedup.ts`, `02-redis-dedup.ts`              |


---

### Integration

Deliverability conventions, observability, and dashboard segmentation.


| Rule                             | Severity | Resend docs                                                               | Rule file                                                                                            | Test                                                                                                                    |
| -------------------------------- | -------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| From address not friendly format | info     | [Send email API](https://resend.com/docs/api-reference/emails/send-email) | [from-address-not-friendly-format.ts](rules/from-address-not-friendly-format.ts) | [resend-from-address-not-friendly-format.test.ts](../../../tests/rules/resend-from-address-not-friendly-format.test.ts) |
| Missing tags                     | info     | [Tags](https://resend.com/docs/dashboard/emails/tags)                     | [missing-tags.ts](rules/missing-tags.ts)                                         | [resend-missing-tags.test.ts](../../../tests/rules/resend-missing-tags.test.ts)                                         |
| Request id not logged            | info     | [Errors](https://resend.com/docs/api-reference/errors)                    | [request-id-not-logged.ts](rules/request-id-not-logged.ts)                       | [resend-request-id-not-logged.test.ts](../../../tests/rules/resend-request-id-not-logged.test.ts)                       |


#### Fixtures


| Rule                  | Broken                                                                                           | Fixed                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| From address format   | `resend-from-address-not-friendly-format-broken/01-emails-send-bare.ts`, `02-batch-send-bare.ts` | `resend-from-address-not-friendly-format-fixed/01-friendly-name.ts`, `02-dynamic-from.ts`            |
| Missing tags          | `resend-missing-tags-broken/01-emails-send-no-tags.ts`, `02-batch-item-no-tags.ts`               | `resend-missing-tags-fixed/01-emails-send-with-tags.ts`, `02-non-resend-send.ts`                     |
| Request id not logged | `resend-request-id-not-logged-broken/01-if-error.ts`, `02-catch.ts`                              | `resend-request-id-not-logged-fixed/01-if-error-with-request-id.ts`, `02-catch-resend-request-id.ts` |


---

## Test summary


| Category    | Rules  | Test files                  | Fixture pairs                                |
| ----------- | ------ | --------------------------- | -------------------------------------------- |
| Security    | 3      | 3 (+ scanner)               | 3 broken + 1 legacy webhook dir              |
| Correctness | 3      | 3                           | 3                                            |
| Reliability | 4      | 4                           | 4                                            |
| Integration | 3      | 3                           | 3                                            |
| **Total**   | **13** | **13 rule tests + scanner** | **26 broken/fixed dirs + webhook-signature** |


### Running tests

```bash
# All Resend rule tests
pnpm build
npx vitest run tests/rules/resend-

# Single rule
npx vitest run tests/rules/resend-api-key-hardcoded.test.ts

# Webhook signature (legacy path + scanner)
npx vitest run tests/resend-webhook-signature.test.ts tests/scanner.test.ts

# Lint a fixture directory end-to-end
node dist/cli.mjs tests/fixtures/resend/resend-api-key-hardcoded-broken
```

### Test harness

Rule tests use [tests/helpers/lint-rule.ts](../../../tests/helpers/lint-rule.ts):

- `fixtureDir(ruleKey, 'broken' | 'fixed')` — resolves `tests/fixtures/resend/<rule-key>-<kind>/`
- `lintFileForRule(ruleKey, filePath)` — runs oxlint with only that rule enabled

Reporter tests (`tests/reporter/`) cover snippet extraction, report JSON shape, and CLI output modes against these same fixtures.

---

## Severity in reports


| Severity | Count today | Affects score |
| -------- | ----------- | ------------- |
| error    | 5 rules     | −15 each      |
| warning  | 5 rules     | −5 each       |
| info     | 3 rules     | no penalty    |


Structured reports include each rule's `meta.docs.rationale` under **Why this matters** (markdown export).