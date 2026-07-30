import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { collectCoverage } from '../../src/coverage/collect.js';
import { scan } from '../../src/scanner.js';
import type { DetectedProvider } from '../../src/types.js';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'openai');

function detectedOpenai(
  files: string[],
  source: DetectedProvider['source'] = 'imports',
): DetectedProvider[] {
  return [{ name: 'openai', source, checked: true, files }];
}

function contents(entries: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(entries));
}

describe('collectCoverage (openai)', () => {
  it('records methods called on a client constructed from the default import', () => {
    const files = contents({
      'src/assistant.ts': `
        import OpenAI from 'openai';
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const response = await openai.responses.create({ model: 'gpt-5.2', input: 'hi' });
        await openai.responses.retrieve(response.id);
      `,
    });
    const coverage = collectCoverage(detectedOpenai(['src/assistant.ts']), files);
    expect(coverage).toEqual([
      { provider: 'openai', used: ['responses.create', 'responses.retrieve'], unknownSdkCalls: 0 },
    ]);
  });

  it('records nested resource paths from named and namespace imports', () => {
    const files = contents({
      'src/chat.ts': `
        import { OpenAI } from 'openai';
        const openai = new OpenAI({ apiKey: 'sk-1' });
        await openai.chat.completions.create({ model: 'gpt-5.2', messages: [] });
        await openai.fineTuning.jobs.create({ model: 'gpt-5.2', training_file: 'file-1' });
      `,
      'src/audio.ts': `
        import * as sdk from 'openai';
        const client = new sdk.OpenAI({ apiKey: 'sk-1' });
        await client.audio.transcriptions.create({ file: blob, model: 'gpt-4o-transcribe' });
        await client.vectorStores.files.uploadAndPoll('vs_1', blob);
      `,
    });
    const coverage = collectCoverage(detectedOpenai(['src/chat.ts', 'src/audio.ts']), files);
    expect(coverage?.[0].used).toEqual([
      'audio.transcriptions.create',
      'chat.completions.create',
      'fineTuning.jobs.create',
      'vectorStores.files.uploadAndPoll',
    ]);
  });

  it('verifies AzureOpenAI as a client constructor for the same surface', () => {
    const files = contents({
      'src/azure.ts': `
        import { AzureOpenAI } from 'openai';
        const azure = new AzureOpenAI({ endpoint: 'https://example.openai.azure.com' });
        await azure.chat.completions.create({ model: 'gpt-5.2', messages: [] });
        await azure.embeddings.create({ model: 'text-embedding-3-small', input: 'x' });
      `,
    });
    const coverage = collectCoverage(detectedOpenai(['src/azure.ts']), files);
    expect(coverage?.[0].used).toEqual(['chat.completions.create', 'embeddings.create']);
  });

  it('trusts wrapper imports that resolve to a module verifiably exporting a client', () => {
    const files = contents({
      'src/lib/openai.ts': `
        import OpenAI from 'openai';
        export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      `,
      'src/route.ts': `
        import { openai } from '@/lib/openai';
        await openai.moderations.create({ input: 'user text' });
      `,
    });
    const coverage = collectCoverage(detectedOpenai(['src/lib/openai.ts']), files);
    expect(coverage?.[0].used).toEqual(['moderations.create']);
  });

  it('counts verified-client calls outside the surface as unknown, never named', () => {
    const files = contents({
      'src/lowlevel.ts': `
        import OpenAI from 'openai';
        const openai = new OpenAI({ apiKey: 'sk-1' });
        await openai.post('/responses', { body: {} });   // transport escape hatch
        await openai.graders.graderModels.run({});       // types-only container, no such method
        await openai.batches.create({ endpoint: '/v1/responses', input_file_id: 'f' });
      `,
    });
    const coverage = collectCoverage(detectedOpenai(['src/lowlevel.ts']), files);
    expect(coverage?.[0].used).toEqual(['batches.create']);
    expect(coverage?.[0].unknownSdkCalls).toBe(2);
  });

  it('does not credit Agents SDK usage — only openai-package clients are verified', () => {
    const files = contents({
      'src/agent.ts': `
        import { Agent, Runner, run } from '@openai/agents';
        const agent = new Agent({ name: 'helper', instructions: 'Assist.' });
        const runner = new Runner();
        await runner.run(agent, 'do the thing');
        await run(agent, 'again');
      `,
    });
    const coverage = collectCoverage(detectedOpenai(['src/agent.ts']), files);
    expect(coverage?.[0].used).toEqual([]);
    expect(coverage?.[0].unknownSdkCalls).toBe(0);
  });
});

describe('scan() coverage integration (openai)', () => {
  it('collects surface usage across client patterns and applies documented punts', async () => {
    const { coverage, results } = await scan(join(fixtures, 'coverage-basic'));
    expect(coverage).toHaveLength(1);
    expect(coverage?.[0].provider).toBe('openai');
    // responses.create from the renamed client, embeddings.create via dynamic
    // access on a wrapper import. The reference-only models.list, the
    // destructured files.list, the wrong-root responses.retrieve, and the
    // test-file moderations.create must all be absent.
    expect(coverage?.[0].used).toEqual(['embeddings.create', 'responses.create']);
    // The openai.get() escape hatch in punts.ts is counted, never named.
    expect(coverage?.[0].unknownSdkCalls).toBe(1);
    // Coverage never surfaces as a finding.
    for (const r of results) {
      expect(r.rule).not.toContain('coverage');
    }
  });

  it('omits coverage entirely when detection came from a URL pattern alone', async () => {
    const { coverage, detected } = await scan(join(fixtures, 'coverage-url-only'));
    expect(detected.map((d) => d.name)).toContain('openai');
    expect(detected.find((d) => d.name === 'openai')?.source).toBe('url-patterns');
    expect(coverage).toBeUndefined();
  });
});
