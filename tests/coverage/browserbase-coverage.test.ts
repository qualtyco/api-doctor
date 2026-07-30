import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { collectCoverage } from '../../src/coverage/collect.js';
import { scan } from '../../src/scanner.js';
import type { DetectedProvider } from '../../src/types.js';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'browserbase');

function detectedBrowserbase(
  files: string[],
  source: DetectedProvider['source'] = 'imports',
): DetectedProvider[] {
  return [{ name: 'browserbase', source, checked: true, files }];
}

function contents(entries: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(entries));
}

describe('collectCoverage (browserbase)', () => {
  it('records methods called on a client constructed from the default import', () => {
    const files = contents({
      'src/browser.ts': `
        import Browserbase from '@browserbasehq/sdk';
        const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });
        const session = await bb.sessions.create({ projectId: 'p_1' });
        await bb.sessions.debug(session.id);
      `,
    });
    const coverage = collectCoverage(detectedBrowserbase(['src/browser.ts']), files);
    expect(coverage).toEqual([
      { provider: 'browserbase', used: ['sessions.create', 'sessions.debug'], unknownSdkCalls: 0 },
    ]);
  });

  it('records nested resource paths from named and namespace imports', () => {
    const files = contents({
      'src/recordings.ts': `
        import { Browserbase } from '@browserbasehq/sdk';
        const bb = new Browserbase({ apiKey: 'bb_live_1' });
        await bb.sessions.recording.retrieve('sess_1');
        await bb.sessions.recording.downloads.create('sess_1');
      `,
      'src/agents.ts': `
        import * as sdk from '@browserbasehq/sdk';
        const client = new sdk.Browserbase({ apiKey: 'bb_live_1' });
        await client.agents.runs.create({ task: 'find pricing' });
        await client.agents.runs.listMessages('run_1');
      `,
    });
    const coverage = collectCoverage(
      detectedBrowserbase(['src/recordings.ts', 'src/agents.ts']),
      files,
    );
    expect(coverage?.[0].used).toEqual([
      'agents.runs.create',
      'agents.runs.listMessages',
      'sessions.recording.downloads.create',
      'sessions.recording.retrieve',
    ]);
  });

  it('trusts wrapper imports that resolve to a module verifiably exporting a client', () => {
    const files = contents({
      'src/lib/browserbase.ts': `
        import Browserbase from '@browserbasehq/sdk';
        export const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });
      `,
      'src/route.ts': `
        import { bb } from '@/lib/browserbase';
        await bb.contexts.create({ projectId: 'p_1' });
      `,
    });
    const coverage = collectCoverage(detectedBrowserbase(['src/lib/browserbase.ts']), files);
    expect(coverage?.[0].used).toEqual(['contexts.create']);
  });

  it('counts verified-client calls outside the surface as unknown, never named', () => {
    const files = contents({
      'src/lowlevel.ts': `
        import Browserbase from '@browserbasehq/sdk';
        const bb = new Browserbase({ apiKey: 'bb_live_1' });
        await bb.get('/v1/sessions');               // transport escape hatch
        await bb.agents.runs.stop('run_1');         // spec endpoint the SDK has no method for
        await bb.projects.usage('p_1');             // documented — used, not unknown
      `,
    });
    const coverage = collectCoverage(detectedBrowserbase(['src/lowlevel.ts']), files);
    expect(coverage?.[0].used).toEqual(['projects.usage']);
    expect(coverage?.[0].unknownSdkCalls).toBe(2);
  });

  it('does not credit Stagehand usage — only @browserbasehq/sdk clients are verified', () => {
    const files = contents({
      'src/stagehand.ts': `
        import { Stagehand } from '@browserbasehq/stagehand';
        const stagehand = new Stagehand({ env: 'BROWSERBASE' });
        await stagehand.sessions.create({ projectId: 'p_1' });
      `,
    });
    const coverage = collectCoverage(detectedBrowserbase(['src/stagehand.ts']), files);
    expect(coverage?.[0].used).toEqual([]);
    expect(coverage?.[0].unknownSdkCalls).toBe(0);
  });
});

describe('scan() coverage integration (browserbase)', () => {
  it('collects surface usage across client patterns and applies documented punts', async () => {
    const { coverage, results } = await scan(join(fixtures, 'coverage-basic'));
    expect(coverage).toHaveLength(1);
    expect(coverage?.[0].provider).toBe('browserbase');
    // sessions.create from the renamed client, contexts.create via dynamic
    // access on a wrapper import. The reference-only sessions.debug, the
    // destructured sessions.list, the wrong-root sessions.retrieve, and the
    // test-file projects.list must all be absent.
    expect(coverage?.[0].used).toEqual(['contexts.create', 'sessions.create']);
    // The bb.get() escape hatch in punts.ts is counted, never named.
    expect(coverage?.[0].unknownSdkCalls).toBe(1);
    // Coverage never surfaces as a finding.
    for (const r of results) {
      expect(r.rule).not.toContain('coverage');
    }
  });

  it('omits coverage entirely when detection came from a URL pattern alone', async () => {
    const { coverage, detected } = await scan(join(fixtures, 'coverage-url-only'));
    expect(detected.map((d) => d.name)).toContain('browserbase');
    expect(detected.find((d) => d.name === 'browserbase')?.source).toBe('url-patterns');
    expect(coverage).toBeUndefined();
  });
});
