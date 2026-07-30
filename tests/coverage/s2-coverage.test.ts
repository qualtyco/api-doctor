import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { collectCoverage } from '../../src/coverage/collect.js';
import { scan } from '../../src/scanner.js';
import type { DetectedProvider } from '../../src/types.js';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 's2');

function detectedS2(
  files: string[],
  source: DetectedProvider['source'] = 'imports',
): DetectedProvider[] {
  return [{ name: 's2', source, checked: true, files }];
}

function contents(entries: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(entries));
}

describe('collectCoverage (s2)', () => {
  it('records account-plane methods called on a directly constructed client', () => {
    const files = contents({
      'src/admin.ts': `
        import { S2 } from '@s2-dev/streamstore';
        const client = new S2({ accessToken: process.env.S2_ACCESS_TOKEN! });
        await client.basins.create({ basin: 'telemetry' });
        await client.accessTokens.revoke({ id: 'old-token' });
        await client.locations.getDefault();
      `,
    });
    const coverage = collectCoverage(detectedS2(['src/admin.ts']), files);
    expect(coverage).toEqual([
      {
        provider: 's2',
        used: ['accessTokens.revoke', 'basins.create', 'locations.getDefault'],
        unknownSdkCalls: 0,
      },
    ]);
  });

  it('attributes only the basin() accessor for chained data-plane calls', () => {
    const files = contents({
      'src/append.ts': `
        import { AppendInput, AppendRecord, S2 } from '@s2-dev/streamstore';
        const client = new S2({ accessToken: process.env.S2_ACCESS_TOKEN! });
        // Chain through an intermediate call: stream()/append() ride on the
        // return value of basin(), which the collector cannot verify.
        await client
          .basin('logs')
          .stream('events')
          .append(AppendInput.create([AppendRecord.string({ body: 'x' })]));
        // Scoped-client variable: also unverifiable, must not count.
        const basin = client.basin('logs');
        await basin.streams.create({ stream: 'events' });
      `,
    });
    const coverage = collectCoverage(detectedS2(['src/append.ts']), files);
    // The dropped chain segments are silent punts, not unknown calls — they
    // are not made on a verified client, so they must not inflate the count.
    expect(coverage).toEqual([{ provider: 's2', used: ['basin'], unknownSdkCalls: 0 }]);
  });

  it('trusts wrapper imports that resolve to a module verifiably exporting a client', () => {
    const files = contents({
      'src/lib/s2.ts': `
        import { S2 } from '@s2-dev/streamstore';
        export const s2 = new S2({ accessToken: process.env.S2_ACCESS_TOKEN! });
      `,
      'src/route.ts': `
        import { s2 } from '@/lib/s2';
        for await (const basin of s2.basins.listAll({ prefix: 'tenant-' })) {
          console.log(basin.name);
        }
      `,
    });
    const coverage = collectCoverage(detectedS2(['src/lib/s2.ts']), files);
    expect(coverage?.[0].used).toEqual(['basins.listAll']);
  });

  it('counts calls outside the surface on a verified client as unknown, never used', () => {
    const files = contents({
      'src/hallucinated.ts': `
        import { S2 } from '@s2-dev/streamstore';
        const client = new S2({ accessToken: process.env.S2_ACCESS_TOKEN! });
        await client.basins.get({ basin: 'telemetry' }); // no such method (getConfig)
        await client.metrics.stream({ basin: 'telemetry', stream: 'events', set: 'append-ops' });
      `,
    });
    const coverage = collectCoverage(detectedS2(['src/hallucinated.ts']), files);
    expect(coverage?.[0].used).toEqual(['metrics.stream']);
    expect(coverage?.[0].unknownSdkCalls).toBe(1);
  });

  it('skips coverage entirely for url-pattern-only detection', () => {
    const files = contents({
      'src/raw.ts': `await fetch('https://aws.s2.dev/v1/streams/events/records/tail');`,
    });
    const coverage = collectCoverage(detectedS2(['src/raw.ts'], 'url-patterns'), files);
    expect(coverage).toBeUndefined();
  });
});

describe('scan() coverage integration (s2)', () => {
  it('collects surface usage across client patterns and applies documented punts', async () => {
    const { coverage, results } = await scan(join(fixtures, 'coverage-basic'));
    expect(coverage).toHaveLength(1);
    expect(coverage?.[0].provider).toBe('s2');
    // basins.list / accessTokens.issue via the wrapper import, metrics.account
    // from the renamed client, locations.list via dynamic access, and `basin`
    // from the data-plane chain. The chained stream()/append(), the
    // scoped-variable streams.list, the reference-only basins.list, the
    // destructured accessTokens.list, the wrong-root basins.list, and the
    // test-file basins.delete must all be absent.
    expect(coverage?.[0].used).toEqual([
      'accessTokens.issue',
      'basin',
      'basins.list',
      'locations.list',
      'metrics.account',
    ]);
    // Dropped chain segments are silent punts, not unknown calls.
    expect(coverage?.[0].unknownSdkCalls).toBe(0);
    // Coverage never surfaces as a finding.
    for (const r of results) {
      expect(r.rule).not.toContain('coverage');
    }
  });

  it('omits coverage entirely when detection came from a URL pattern alone', async () => {
    const { coverage, detected } = await scan(join(fixtures, 'coverage-url-only'));
    expect(detected.map((d) => d.name)).toContain('s2');
    expect(detected.find((d) => d.name === 's2')?.source).toBe('url-patterns');
    expect(coverage).toBeUndefined();
  });
});
