import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLUGIN_NAME } from '../src/constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const fixturesDir = join(__dirname, 'fixtures', 'webhook-signature');
// Fixtures whose path must NOT contain "webhook", to exercise the
// webhook-evidence gate (path is one of the evidence signals).
const scopeFixturesDir = join(__dirname, 'fixtures', 'signature-scope');
const oxlintBin = join(process.cwd(), 'node_modules/.bin/oxlint');
const pluginDist = join(process.cwd(), 'dist/plugin.js');

const ruleId = `${PLUGIN_NAME}/resend-webhook-signature`;
const pluginRuleCodeSubstring = 'resend-webhook-signature';
const missingVerificationMessage =
  'This webhook handler processes Resend events without verifying the signature first.';

function lintFile(filePath: string): any[] {
  const tmp = mkdtempSync(join(os.tmpdir(), 'api-doctor-oxlint-'));
  const configPath = join(tmp, 'oxlintrc.json');
  const config = {
    jsPlugins: [pluginDist],
    rules: {
      [ruleId]: 'error',
    },
  };

  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

  const res = spawnSync(
    oxlintBin,
    ['-c', configPath, '--format', 'json', filePath],
    { encoding: 'utf8' },
  );

  try {
    const parsed = JSON.parse(res.stdout);
    return parsed.diagnostics ?? [];
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

describe('resend-webhook-signature rule', () => {
  it('flags broken: no verify call', () => {
    const file = join(fixturesDir, 'resend-broken-no-verify.ts');
    const diags = lintFile(file);
    const ours = diags.filter((d: any) => String(d.code ?? '').includes(pluginRuleCodeSubstring));
    expect(ours.some((d: any) => d.message === missingVerificationMessage)).toBe(true);
  });

  it('flags broken: verify after body access', () => {
    const file = join(fixturesDir, 'resend-broken-late-verify.ts');
    const diags = lintFile(file);
    const ours = diags.filter((d: any) => String(d.code ?? '').includes(pluginRuleCodeSubstring));
    expect(ours.some((d: any) => d.message === missingVerificationMessage)).toBe(true);
  });

  it('flags broken: comment-only verify', () => {
    const file = join(fixturesDir, 'resend-broken-comment-only.ts');
    const diags = lintFile(file);
    const ours = diags.filter((d: any) => String(d.code ?? '').includes(pluginRuleCodeSubstring));
    expect(ours.some((d: any) => d.message === missingVerificationMessage)).toBe(true);
  });

  it('flags broken: wrapper `@/lib/resend` import with no verify call', () => {
    const file = join(fixturesDir, 'resend-broken-wrapper-import-no-verify.ts');
    const diags = lintFile(file);
    const ours = diags.filter((d: any) => String(d.code ?? '').includes(pluginRuleCodeSubstring));
    expect(ours.some((d: any) => d.message === missingVerificationMessage)).toBe(true);
  });

  it('does not flag: verify before body access', () => {
    const file = join(fixturesDir, 'resend-ok-verify-first.ts');
    const diags = lintFile(file);
    const ours = diags.filter((d: any) => String(d.code ?? '').includes(pluginRuleCodeSubstring));
    expect(ours).toHaveLength(0);
  });

  it('does not flag: renamed svix import', () => {
    const file = join(fixturesDir, 'resend-ok-renamed-import.ts');
    const diags = lintFile(file);
    const ours = diags.filter((d: any) => String(d.code ?? '').includes(pluginRuleCodeSubstring));
    expect(ours).toHaveLength(0);
  });

  it('does not flag: non-resend webhook', () => {
    const file = join(fixturesDir, 'resend-ok-non-resend-webhook.ts');
    const diags = lintFile(file);
    const ours = diags.filter((d: any) => String(d.code ?? '').includes(pluginRuleCodeSubstring));
    expect(ours).toHaveLength(0);
  });

  it('does not flag: string literal contains webhook.verify', () => {
    const file = join(fixturesDir, 'resend-ok-string-literal.ts');
    const diags = lintFile(file);
    const ours = diags.filter((d: any) => String(d.code ?? '').includes(pluginRuleCodeSubstring));
    expect(ours).toHaveLength(0);
  });

  it('does not flag: resend.webhooks.verify() via a wrapped `@/lib/resend` import (Resend\'s own docs example, verified genuinely)', () => {
    const file = join(fixturesDir, 'resend-ok-native-verify.ts');
    const diags = lintFile(file);
    const ours = diags.filter((d: any) => String(d.code ?? '').includes(pluginRuleCodeSubstring));
    expect(ours).toHaveLength(0);
  });

  it('does not flag: resend.webhooks.verify() with a direct `resend` import', () => {
    const file = join(fixturesDir, 'resend-ok-native-verify-direct-import.ts');
    const diags = lintFile(file);
    const ours = diags.filter((d: any) => String(d.code ?? '').includes(pluginRuleCodeSubstring));
    expect(ours).toHaveLength(0);
  });

  it('does not flag: doc page with webhook code embedded as a string literal', () => {
    const file = join(fixturesDir, 'resend-ok-doc-page-embedded-code-string.tsx');
    const diags = lintFile(file);
    const ours = diags.filter((d: any) => String(d.code ?? '').includes(pluginRuleCodeSubstring));
    expect(ours).toHaveLength(0);
  });

  // Webhook-evidence gate: a POST route is only a webhook handler when the
  // file shows webhook evidence (path, svix usage, or Resend event types).
  it('does not flag: outbound send route with no webhook evidence', () => {
    const file = join(scopeFixturesDir, 'send-route.ts');
    const diags = lintFile(file);
    const ours = diags.filter((d: any) => String(d.code ?? '').includes(pluginRuleCodeSubstring));
    expect(ours).toHaveLength(0);
  });

  it('flags: event consumer in a non-webhook path via event-type literal evidence', () => {
    const file = join(scopeFixturesDir, 'bounce-event-handler.ts');
    const diags = lintFile(file);
    const ours = diags.filter((d: any) => String(d.code ?? '').includes(pluginRuleCodeSubstring));
    expect(ours.some((d: any) => d.message === missingVerificationMessage)).toBe(true);
  });

  it('flags: event consumer branching on a constant, not an inline event literal', () => {
    const file = join(scopeFixturesDir, 'event-consumer-constant.ts');
    const diags = lintFile(file);
    const ours = diags.filter((d: any) => String(d.code ?? '').includes(pluginRuleCodeSubstring));
    expect(ours.some((d: any) => d.message === missingVerificationMessage)).toBe(true);
  });

  // oxlint supplies an absolute path. Evidence must come from the file's own
  // location and behaviour, never from an ancestor directory that happens to
  // be named "webhooks" — otherwise results depend on checkout location.
  it('does not flag: send route whose ancestor directory is named webhook', () => {
    const tmp = mkdtempSync(join(os.tmpdir(), 'api-doctor-webhook-platform-'));
    try {
      const nested = join(tmp, 'webhook-platform', 'app', 'api', 'send');
      mkdirSync(nested, { recursive: true });
      const target = join(nested, 'route.ts');
      copyFileSync(join(scopeFixturesDir, 'send-route.ts'), target);
      const diags = lintFile(target);
      const ours = diags.filter((d: any) => String(d.code ?? '').includes(pluginRuleCodeSubstring));
      expect(ours).toHaveLength(0);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
