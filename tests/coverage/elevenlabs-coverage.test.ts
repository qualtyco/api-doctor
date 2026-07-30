import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { collectCoverage } from '../../src/coverage/collect.js';
import { scan } from '../../src/scanner.js';
import type { DetectedProvider } from '../../src/types.js';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'elevenlabs');

function detectedElevenlabs(
  files: string[],
  source: DetectedProvider['source'] = 'imports',
): DetectedProvider[] {
  return [{ name: 'elevenlabs', source, checked: true, files }];
}

function contents(entries: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(entries));
}

describe('collectCoverage (elevenlabs)', () => {
  it('records methods called on a directly constructed client', () => {
    const files = contents({
      'src/narrate.ts': `
        import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
        const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
        const audio = await client.textToSpeech.convert('JBFqnCBsd6RMkjVDRZzb', { text: 'hello' });
      `,
    });
    const coverage = collectCoverage(detectedElevenlabs(['src/narrate.ts']), files);
    expect(coverage).toEqual([
      { provider: 'elevenlabs', used: ['textToSpeech.convert'], unknownSdkCalls: 0 },
    ]);
  });

  it('records deeply nested resource paths (pvc samples, dubbing project transcript)', () => {
    const files = contents({
      'src/nested.ts': `
        import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
        const client = new ElevenLabsClient({ apiKey: 'sk_1' });
        await client.voices.pvc.samples.speakers.separate('voice_1', 'sample_1');
        await client.dubbing.project.language.transcript.regenerate('proj_1', 'lang_1');
        await client.pronunciationDictionaries.rules.add('dict_1', { rules: [] });
      `,
    });
    const coverage = collectCoverage(detectedElevenlabs(['src/nested.ts']), files);
    expect(coverage?.[0].used).toEqual([
      'dubbing.project.language.transcript.regenerate',
      'pronunciationDictionaries.rules.add',
      'voices.pvc.samples.speakers.separate',
    ]);
  });

  it('verifies clients constructed from the legacy elevenlabs package too', () => {
    const files = contents({
      'src/legacy.ts': `
        import { ElevenLabsClient } from 'elevenlabs';
        const client = new ElevenLabsClient({ apiKey: 'sk_1' });
        await client.speechToSpeech.convert('voice_1', { audio: blob });
      `,
    });
    const coverage = collectCoverage(detectedElevenlabs(['src/legacy.ts']), files);
    expect(coverage?.[0].used).toEqual(['speechToSpeech.convert']);
  });

  it('trusts wrapper imports that resolve to a module verifiably exporting a client', () => {
    const files = contents({
      'src/lib/elevenlabs.ts': `
        import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
        export const elevenlabs = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
      `,
      'src/route.ts': `
        import { elevenlabs } from '@/lib/elevenlabs';
        await elevenlabs.textToDialogue.stream({ inputs: [] });
      `,
    });
    const coverage = collectCoverage(detectedElevenlabs(['src/lib/elevenlabs.ts']), files);
    expect(coverage?.[0].used).toEqual(['textToDialogue.stream']);
  });

  it('counts passthrough, out-of-scope roots, and wrapper helpers as unknown, never used', () => {
    const files = contents({
      'src/lowlevel.ts': `
        import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
        const client = new ElevenLabsClient({ apiKey: 'sk_1' });
        await client.fetch('/v1/models');                        // passthrough escape hatch
        await client.conversationalAi.agents.list();             // agents/ConvAI: out of ElevenAPI scope
        await client.speechToText.realtime.connect({ url: 'x' }); // wrapper-only WebSocket helper
        await client.speechToText.convert({ modelId: 'scribe_v1' });
      `,
    });
    const coverage = collectCoverage(detectedElevenlabs(['src/lowlevel.ts']), files);
    expect(coverage?.[0].used).toEqual(['speechToText.convert']);
    expect(coverage?.[0].unknownSdkCalls).toBe(3);
  });

  it('skips coverage entirely for url-pattern-only detection', () => {
    const files = contents({
      'src/raw.ts': `await fetch('https://api.elevenlabs.io/v1/voices', { headers: {} });`,
    });
    const coverage = collectCoverage(detectedElevenlabs(['src/raw.ts'], 'url-patterns'), files);
    expect(coverage).toBeUndefined();
  });
});

describe('scan() coverage integration (elevenlabs)', () => {
  it('collects surface usage across client patterns and applies documented punts', async () => {
    const { coverage, results } = await scan(join(fixtures, 'coverage-basic'));
    expect(coverage).toHaveLength(1);
    expect(coverage?.[0].provider).toBe('elevenlabs');
    // textToSpeech.convert from the renamed client, voices.search via dynamic
    // access on a wrapper import. The reference-only dubbing.create, the
    // destructured voices.getAll, the wrong-root textToSpeech.convert on a
    // plain object, and the test-file textToSpeech.convert must all be absent.
    expect(coverage?.[0].used).toEqual(['textToSpeech.convert', 'voices.search']);
    // Coverage never surfaces as a finding.
    for (const r of results) {
      expect(r.rule).not.toContain('coverage');
    }
  });

  it('omits coverage entirely when detection came from a URL pattern alone', async () => {
    const { coverage, detected } = await scan(join(fixtures, 'coverage-url-only'));
    expect(detected.map((d) => d.name)).toContain('elevenlabs');
    expect(detected.find((d) => d.name === 'elevenlabs')?.source).toBe('url-patterns');
    expect(coverage).toBeUndefined();
  });
});
