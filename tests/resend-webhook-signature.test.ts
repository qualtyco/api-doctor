import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLUGIN_NAME } from '../src/constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const fixturesDir = join(__dirname, 'fixtures', 'webhook-signature');
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
});
