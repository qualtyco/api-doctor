import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { lintPythonFixture } from '../helpers/lint-python-rule.js';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/tiptap');

describe('tiptap-script-src-hardcoded-api-key (python)', () => {
  it('flags hardcoded apiKey= in script src', () => {
    const diags = lintPythonFixture(join(fixtures, 'tiptap-script-src-hardcoded-api-key-broken'), [
      'tiptap-script-src-hardcoded-api-key',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'tiptap-script-src-hardcoded-api-key').length).toBeGreaterThanOrEqual(2);
  });

  it('does not flag env-based keys or key-free src values', () => {
    const diags = lintPythonFixture(join(fixtures, 'tiptap-script-src-hardcoded-api-key-fixed'), [
      'tiptap-script-src-hardcoded-api-key',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'tiptap-script-src-hardcoded-api-key')).toHaveLength(0);
  });
});

describe('tiptap-dynamic-script-no-sri (python)', () => {
  it('flags <script src=...> HTML strings with no integrity attribute', () => {
    const diags = lintPythonFixture(join(fixtures, 'tiptap-dynamic-script-no-sri-broken'), [
      'tiptap-dynamic-script-no-sri',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'tiptap-dynamic-script-no-sri').length).toBeGreaterThanOrEqual(2);
  });

  it('does not flag scripts with integrity set, or non-script strings', () => {
    const diags = lintPythonFixture(join(fixtures, 'tiptap-dynamic-script-no-sri-fixed'), [
      'tiptap-dynamic-script-no-sri',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'tiptap-dynamic-script-no-sri')).toHaveLength(0);
  });
});

describe('tiptap-upload-validate-fn-void (python)', () => {
  it('flags void-typed validate_fn params and bare validate_fn(...) calls', () => {
    const diags = lintPythonFixture(join(fixtures, 'tiptap-upload-validate-fn-void-broken'), [
      'tiptap-upload-validate-fn-void',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'tiptap-upload-validate-fn-void').length).toBeGreaterThanOrEqual(2);
  });

  it('does not flag guarded calls or non-void-typed validate_fn', () => {
    const diags = lintPythonFixture(join(fixtures, 'tiptap-upload-validate-fn-void-fixed'), [
      'tiptap-upload-validate-fn-void',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'tiptap-upload-validate-fn-void')).toHaveLength(0);
  });
});

describe('tiptap-addAttributes-missing-renderHTML (python)', () => {
  it('flags descriptor dicts with parseHTML but no renderHTML', () => {
    const diags = lintPythonFixture(join(fixtures, 'tiptap-addAttributes-missing-renderHTML-broken'), [
      'tiptap-addAttributes-missing-renderHTML',
    ]);
    expect(
      diags.filter((d) => d.ruleKey === 'tiptap-addAttributes-missing-renderHTML').length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('does not flag descriptors with renderHTML, or unrelated dicts', () => {
    const diags = lintPythonFixture(join(fixtures, 'tiptap-addAttributes-missing-renderHTML-fixed'), [
      'tiptap-addAttributes-missing-renderHTML',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'tiptap-addAttributes-missing-renderHTML')).toHaveLength(0);
  });
});

describe('tiptap-appendTransaction-add-to-history (python)', () => {
  it('flags mutating append_transaction hooks with no addToHistory meta', () => {
    const diags = lintPythonFixture(join(fixtures, 'tiptap-appendTransaction-add-to-history-broken'), [
      'tiptap-appendTransaction-add-to-history',
    ]);
    expect(
      diags.filter((d) => d.ruleKey === 'tiptap-appendTransaction-add-to-history').length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('does not flag guarded mutations or read-only hooks', () => {
    const diags = lintPythonFixture(join(fixtures, 'tiptap-appendTransaction-add-to-history-fixed'), [
      'tiptap-appendTransaction-add-to-history',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'tiptap-appendTransaction-add-to-history')).toHaveLength(0);
  });
});

describe('tiptap-appendTransaction-full-scan (python)', () => {
  it('flags unguarded doc.descendants() scans in append_transaction', () => {
    const diags = lintPythonFixture(join(fixtures, 'tiptap-appendTransaction-full-scan-broken'), [
      'tiptap-appendTransaction-full-scan',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'tiptap-appendTransaction-full-scan').length).toBeGreaterThanOrEqual(2);
  });

  it('does not flag docChanged-guarded scans or scan-free hooks', () => {
    const diags = lintPythonFixture(join(fixtures, 'tiptap-appendTransaction-full-scan-fixed'), [
      'tiptap-appendTransaction-full-scan',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'tiptap-appendTransaction-full-scan')).toHaveLength(0);
  });
});

describe('tiptap-atom-node-wrap-in (python)', () => {
  it('flags wrap_in() called with an atom node name', () => {
    const diags = lintPythonFixture(join(fixtures, 'tiptap-atom-node-wrap-in-broken'), [
      'tiptap-atom-node-wrap-in',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'tiptap-atom-node-wrap-in').length).toBeGreaterThanOrEqual(2);
  });

  it('does not flag wrap_in() on non-atom nodes', () => {
    const diags = lintPythonFixture(join(fixtures, 'tiptap-atom-node-wrap-in-fixed'), [
      'tiptap-atom-node-wrap-in',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'tiptap-atom-node-wrap-in')).toHaveLength(0);
  });
});

describe('tiptap-drop-handler-pos-precedence (python)', () => {
  it('flags `x or 0 - 1` operator-precedence bugs', () => {
    const diags = lintPythonFixture(join(fixtures, 'tiptap-drop-handler-pos-precedence-broken'), [
      'tiptap-drop-handler-pos-precedence',
    ]);
    expect(
      diags.filter((d) => d.ruleKey === 'tiptap-drop-handler-pos-precedence').length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('does not flag correctly-parenthesized or unrelated `or` expressions', () => {
    const diags = lintPythonFixture(join(fixtures, 'tiptap-drop-handler-pos-precedence-fixed'), [
      'tiptap-drop-handler-pos-precedence',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'tiptap-drop-handler-pos-precedence')).toHaveLength(0);
  });
});

describe('tiptap-prefer-table-kit (python)', () => {
  it('flags 2+ individual table package names in a Python registry', () => {
    const diags = lintPythonFixture(join(fixtures, 'tiptap-prefer-table-kit-broken'), [
      'tiptap-prefer-table-kit',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'tiptap-prefer-table-kit').length).toBeGreaterThanOrEqual(2);
  });

  it('does not flag TableKit-only or single-package registries', () => {
    const diags = lintPythonFixture(join(fixtures, 'tiptap-prefer-table-kit-fixed'), [
      'tiptap-prefer-table-kit',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'tiptap-prefer-table-kit')).toHaveLength(0);
  });
});

describe('tiptap-tiptap-markdown-missing-node-spec (python)', () => {
  it('flags node-spec dicts with no markdown key in a tiptap+markdown file', () => {
    const diags = lintPythonFixture(join(fixtures, 'tiptap-tiptap-markdown-missing-node-spec-broken'), [
      'tiptap-tiptap-markdown-missing-node-spec',
    ]);
    expect(
      diags.filter((d) => d.ruleKey === 'tiptap-tiptap-markdown-missing-node-spec').length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('does not flag specs with a markdown key, or files missing the markdown import', () => {
    const diags = lintPythonFixture(join(fixtures, 'tiptap-tiptap-markdown-missing-node-spec-fixed'), [
      'tiptap-tiptap-markdown-missing-node-spec',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'tiptap-tiptap-markdown-missing-node-spec')).toHaveLength(0);
  });
});
