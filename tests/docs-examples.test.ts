/**
 * Guards against rules flagging the provider's own documented example code.
 *
 * Every file in tests/fixtures/<provider>/docs-examples/ is a verbatim code
 * sample from that provider's official docs, annotated with:
 *
 *   // docs-example-source: <url the sample was copied from>
 *   // docs-example-expected: <rule-id>, <rule-id>   (omit if none)
 *
 * The scan must report exactly the expected rules per file — nothing more
 * (a false positive on official sample code) and nothing less (a rule that
 * silently stopped firing where a human decided it should).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { scan } from '../src/scanner.js';

const fixturesRoot = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

const providers = readdirSync(fixturesRoot).filter((p) =>
  existsSync(join(fixturesRoot, p, 'docs-examples')),
);

describe.each(providers)('%s official docs examples', (provider) => {
  const dir = join(fixturesRoot, provider, 'docs-examples');
  const files = readdirSync(dir)
    .filter((name) => /\.(tsx?|jsx?)$/.test(name))
    .sort();

  it('has at least one example and every example cites its source URL', () => {
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(
        readFileSync(join(dir, file), 'utf8'),
        `${file} must start with a "docs-example-source: <url>" comment`,
      ).toMatch(/docs-example-source: https?:\/\//);
    }
  });

  it('reports exactly the findings each example declares as expected', async () => {
    const { results } = await scan(dir);
    for (const file of files) {
      const source = readFileSync(join(dir, file), 'utf8');
      const match = source.match(/docs-example-expected:([^\n]*)/);
      const expected = (match ? match[1].split(/[,\s]+/).filter(Boolean) : []).sort();
      const actual = [
        ...new Set(
          results.filter((r) => r.file.split('/').pop() === file).map((r) => r.rule),
        ),
      ].sort();
      expect(actual, `rule findings for ${provider}/docs-examples/${file}`).toEqual(expected);
    }
  });
});
