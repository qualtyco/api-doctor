# TipTap

11 oxlint rules for [TipTap](https://tiptap.dev) editor extensions and ProseMirror plugins.


|                          |                                      |
| ------------------------ | ------------------------------------ |
| **Manifest**             | [manifest.ts](manifest.ts)           |
| **Rule implementations** | [rules/](rules/)                     |
| **Shared AST helpers**   | [utils.ts](utils.ts)                 |
| **Fixtures**             | `tests/fixtures/tiptap/`             |
| **Rule tests**           | `tests/rules/tiptap-*.test.ts`       |


Detection: `@tiptap/core`, `@tiptap/react`, or `@tiptap/pm` in package.json, or `tiptap.dev` in source.

---

## Rules and tests by category

### Security

Input validation (upload handlers), hardcoded API keys in dynamically injected scripts, and missing SRI/integrity attributes.

| Rule | Severity | CWE / OWASP | Docs | Rule file | Test |
| ---- | -------- | ----------- | ---- | --------- | ---- |
| upload-validate-fn-void | error | CWE-20 | [Node views](https://tiptap.dev/docs/editor/extensions/custom-extensions/node-views) | [upload-validate-fn-void.ts](rules/upload-validate-fn-void.ts) | [test](../../../tests/rules/tiptap-upload-validate-fn-void.test.ts) |
| script-src-hardcoded-api-key | error | CWE-798, API8:2023 | [Node views](https://tiptap.dev/docs/editor/extensions/custom-extensions/node-views) | [script-src-hardcoded-api-key.ts](rules/script-src-hardcoded-api-key.ts) | [test](../../../tests/rules/tiptap-script-src-hardcoded-api-key.test.ts) |
| dynamic-script-no-sri | warning | CWE-829, API8:2023 | [MDN SRI](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity) | [dynamic-script-no-sri.ts](rules/dynamic-script-no-sri.ts) | [test](../../../tests/rules/tiptap-dynamic-script-no-sri.test.ts) |

#### Security fixtures

| Rule | Broken (`should flag`) | Fixed (`should not flag`) |
| ---- | ---------------------- | ------------------------- |
| upload-validate-fn-void | `tiptap-upload-validate-fn-void-broken/upload-plugin-broken.tsx`, `upload-handler-broken.ts` | `tiptap-upload-validate-fn-void-fixed/upload-plugin-fixed.tsx`, `validate-handler-adversarial.tsx` |
| script-src-hardcoded-api-key | `tiptap-script-src-hardcoded-api-key-broken/desmos-node-broken.ts`, `embed-node-broken.ts` | `tiptap-script-src-hardcoded-api-key-fixed/desmos-node-fixed.ts`, `embed-node-adversarial.ts` |
| dynamic-script-no-sri | `tiptap-dynamic-script-no-sri-broken/desmos-node-broken.ts`, `analytics-script-broken.ts` | `tiptap-dynamic-script-no-sri-fixed/desmos-node-fixed.ts`, `script-removed-adversarial.ts` |

---

### Correctness

HTML serialization round-trips, ProseMirror undo-stack integrity, operator precedence bugs, and atomic command semantics.

| Rule | Severity | Docs | Rule file | Test |
| ---- | -------- | ---- | --------- | ---- |
| addAttributes-missing-renderHTML | error | [Attributes](https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/node#attributes) | [addAttributes-missing-renderHTML.ts](rules/addAttributes-missing-renderHTML.ts) | [test](../../../tests/rules/tiptap-addAttributes-missing-renderHTML.test.ts) |
| appendTransaction-add-to-history | warning | [setMeta](https://prosemirror.net/docs/ref/#state.Transaction.setMeta) | [appendTransaction-add-to-history.ts](rules/appendTransaction-add-to-history.ts) | [test](../../../tests/rules/tiptap-appendTransaction-add-to-history.test.ts) |
| atom-node-wrap-in | warning | [Node types](https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/node) | [atom-node-wrap-in.ts](rules/atom-node-wrap-in.ts) | [test](../../../tests/rules/tiptap-atom-node-wrap-in.test.ts) |
| drop-handler-pos-precedence | warning | [posAtCoords](https://prosemirror.net/docs/ref/#view.EditorView.posAtCoords) | [drop-handler-pos-precedence.ts](rules/drop-handler-pos-precedence.ts) | [test](../../../tests/rules/tiptap-drop-handler-pos-precedence.test.ts) |

#### Correctness fixtures

| Rule | Broken (`should flag`) | Fixed (`should not flag`) |
| ---- | ---------------------- | ------------------------- |
| addAttributes-missing-renderHTML | `tiptap-addAttributes-missing-renderHTML-broken/formula-node-broken.tsx`, `example-node-broken.tsx` | `tiptap-addAttributes-missing-renderHTML-fixed/formula-node-fixed.tsx`, `shorthand-attribute-adversarial.tsx` |
| appendTransaction-add-to-history | `tiptap-appendTransaction-add-to-history-broken/definition-node-broken.tsx`, `spacing-plugin-broken.ts` | `tiptap-appendTransaction-add-to-history-fixed/definition-node-fixed.tsx`, `readonly-appendTransaction-adversarial.ts` |
| atom-node-wrap-in | `tiptap-atom-node-wrap-in-broken/desmos-node-broken.ts`, `embed-node-broken.ts` | `tiptap-atom-node-wrap-in-fixed/desmos-node-fixed.ts`, `container-node-adversarial.ts` |
| drop-handler-pos-precedence | `tiptap-drop-handler-pos-precedence-broken/upload-images-broken.tsx`, `drop-handler-broken.ts` | `tiptap-drop-handler-pos-precedence-fixed/upload-images-fixed.tsx`, `correct-precedence-adversarial.tsx` |

---

### Reliability

Performance issues from quadratic-time document scans on every keystroke.

| Rule | Severity | Docs | Rule file | Test |
| ---- | -------- | ---- | --------- | ---- |
| appendTransaction-full-scan | warning | [appendTransaction](https://prosemirror.net/docs/ref/#state.PluginSpec.appendTransaction) | [appendTransaction-full-scan.ts](rules/appendTransaction-full-scan.ts) | [test](../../../tests/rules/tiptap-appendTransaction-full-scan.test.ts) |

#### Reliability fixtures

| Rule | Broken (`should flag`) | Fixed (`should not flag`) |
| ---- | ---------------------- | ------------------------- |
| appendTransaction-full-scan | `tiptap-appendTransaction-full-scan-broken/definition-node-broken.tsx`, `validator-plugin-broken.ts` | `tiptap-appendTransaction-full-scan-fixed/definition-node-fixed.tsx`, `no-scan-adversarial.ts` |

---

### Integration

Regex completeness (social embeds), extension bundling best practices, and markdown serialization specs.

| Rule | Severity | Docs | Rule file | Test |
| ---- | -------- | ---- | --------- | ---- |
| twitter-url-regex | warning | [Extensions](https://tiptap.dev/docs/editor/extensions/nodes) | [twitter-url-regex.ts](rules/twitter-url-regex.ts) | [test](../../../tests/rules/tiptap-twitter-url-regex.test.ts) |
| prefer-table-kit | info | [Table kit](https://tiptap.dev/docs/editor/extensions/functionality/table-kit) | [prefer-table-kit.ts](rules/prefer-table-kit.ts) | [test](../../../tests/rules/tiptap-prefer-table-kit.test.ts) |
| tiptap-markdown-missing-node-spec | warning | [tiptap-markdown](https://github.com/ueberdosis/tiptap-markdown) | [tiptap-markdown-missing-node-spec.ts](rules/tiptap-markdown-missing-node-spec.ts) | [test](../../../tests/rules/tiptap-tiptap-markdown-missing-node-spec.test.ts) |

#### Integration fixtures

| Rule | Broken (`should flag`) | Fixed (`should not flag`) |
| ---- | ---------------------- | ------------------------- |
| twitter-url-regex | `tiptap-twitter-url-regex-broken/twitter-extension-broken.tsx`, `slash-command-broken.tsx` | `tiptap-twitter-url-regex-fixed/twitter-extension-fixed.tsx`, `github-regex-adversarial.tsx` |
| prefer-table-kit | `tiptap-prefer-table-kit-broken/extensions-broken.ts`, `editor-setup-broken.tsx` | `tiptap-prefer-table-kit-fixed/extensions-fixed.ts`, `table-only-adversarial.ts` |
| tiptap-markdown-missing-node-spec | `tiptap-tiptap-markdown-missing-node-spec-broken/mathematics-broken.ts`, `custom-node-broken.ts` | `tiptap-tiptap-markdown-missing-node-spec-fixed/mathematics-fixed.ts`, `markdown-already-set-adversarial.ts` |

---

## Test summary

| Category    | Rules  | Test files | Fixture pairs |
| ----------- | ------ | ---------- | ------------- |
| Security    | 3      | 3          | 3             |
| Correctness | 4      | 4          | 4             |
| Reliability | 1      | 1          | 1             |
| Integration | 3      | 3          | 3             |
| **Total**   | **11** | **11**     | **11**        |

### Running tests

```bash
# All TipTap rule tests
pnpm build
npx vitest run tests/rules/tiptap-

# Single rule
npx vitest run tests/rules/tiptap-upload-validate-fn-void.test.ts

# Lint a fixture directory end-to-end
node dist/cli.mjs tests/fixtures/tiptap/tiptap-drop-handler-pos-precedence-broken
```

### Test harness

Rule tests use [tests/helpers/lint-rule.ts](../../../tests/helpers/lint-rule.ts):

- `fixtureDir(ruleKey, 'broken' | 'fixed', 'tiptap')` — resolves `tests/fixtures/tiptap/<rule-key>-<kind>/`
- `lintFileForRule(ruleKey, filePath)` — runs oxlint with only that rule enabled

---

## Severity in reports

| Severity | Count | Affects score |
| -------- | ----- | ------------- |
| error    | 2     | −15 each      |
| warning  | 8     | −5 each       |
| info     | 1     | no penalty    |

Structured reports include each rule's `meta.docs.rationale` under **Why this matters** (markdown export).
