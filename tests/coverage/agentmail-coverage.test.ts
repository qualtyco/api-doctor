import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { collectCoverage } from '../../src/coverage/collect.js';
import { scan } from '../../src/scanner.js';
import type { DetectedProvider } from '../../src/types.js';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'agentmail');

function detectedAgentmail(
  files: string[],
  source: DetectedProvider['source'] = 'imports',
): DetectedProvider[] {
  return [{ name: 'agentmail', source, checked: true, files }];
}

function contents(entries: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(entries));
}

describe('collectCoverage (agentmail)', () => {
  it('records methods called on a directly constructed client', () => {
    const files = contents({
      'src/agent.ts': `
        import { AgentMailClient } from 'agentmail';
        const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });
        const inbox = await client.inboxes.create({ clientId: 'support-inbox-v1' });
      `,
    });
    const coverage = collectCoverage(detectedAgentmail(['src/agent.ts']), files);
    expect(coverage).toEqual([
      { provider: 'agentmail', used: ['inboxes.create'], unknownSdkCalls: 0 },
    ]);
  });

  it('records depth-3 nested resource paths on both inboxes and pods trees', () => {
    const files = contents({
      'src/nested.ts': `
        import { AgentMailClient } from 'agentmail';
        const client = new AgentMailClient({ apiKey: 'am_1' });
        await client.inboxes.messages.send('inbox_1', { to: ['a@b.co'], subject: 'x', text: 'y' });
        await client.pods.domains.verify('pod_1', 'domain_1');
        await client.inboxes.lists.create('inbox_1', 'receive', 'allow', { entry: 'a@b.co' });
      `,
    });
    const coverage = collectCoverage(detectedAgentmail(['src/nested.ts']), files);
    expect(coverage?.[0].used).toEqual([
      'inboxes.lists.create',
      'inboxes.messages.send',
      'pods.domains.verify',
    ]);
  });

  it('trusts wrapper imports that resolve to a module verifiably exporting a client', () => {
    const files = contents({
      'src/lib/agentmail.ts': `
        import { AgentMailClient } from 'agentmail';
        export const agentmail = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });
      `,
      'src/route.ts': `
        import { agentmail } from '@/lib/agentmail';
        await agentmail.inboxes.messages.reply('inbox_1', 'msg_1', { text: 'done' });
      `,
    });
    const coverage = collectCoverage(detectedAgentmail(['src/lib/agentmail.ts']), files);
    expect(coverage?.[0].used).toEqual(['inboxes.messages.reply']);
  });

  it('counts the fetch passthrough and unlisted methods as unknown, never as used', () => {
    const files = contents({
      'src/lowlevel.ts': `
        import { AgentMailClient } from 'agentmail';
        const client = new AgentMailClient({ apiKey: 'am_1' });
        await client.fetch('/v0/inboxes');                  // passthrough escape hatch
        await client.inboxes.messages.snooze('i', 'm', {}); // SDK drift / not documented
        await client.webhooks.create({ url: 'https://x.co/hook', eventTypes: ['message.received'] });
      `,
    });
    const coverage = collectCoverage(detectedAgentmail(['src/lowlevel.ts']), files);
    expect(coverage?.[0].used).toEqual(['webhooks.create']);
    expect(coverage?.[0].unknownSdkCalls).toBe(2);
  });

  it('skips coverage entirely for url-pattern-only detection', () => {
    const files = contents({
      'src/raw.ts': `await fetch('https://api.agentmail.to/v0/inboxes', { method: 'POST' });`,
    });
    const coverage = collectCoverage(detectedAgentmail(['src/raw.ts'], 'url-patterns'), files);
    expect(coverage).toBeUndefined();
  });
});

describe('scan() coverage integration (agentmail)', () => {
  it('collects surface usage across client patterns and applies documented punts', async () => {
    const { coverage, results } = await scan(join(fixtures, 'coverage-basic'));
    expect(coverage).toHaveLength(1);
    expect(coverage?.[0].provider).toBe('agentmail');
    // inboxes.messages.send from the renamed client, inboxes.messages.get via
    // dynamic access on a wrapper import. The reference-only
    // inboxes.messages.reply, the destructured threads.list, the wrong-root
    // inboxes.create, and the test-file inboxes.create must all be absent.
    expect(coverage?.[0].used).toEqual(['inboxes.messages.get', 'inboxes.messages.send']);
    // Coverage never surfaces as a finding.
    for (const r of results) {
      expect(r.rule).not.toContain('coverage');
    }
  });

  it('omits coverage entirely when detection came from a URL pattern alone', async () => {
    const { coverage, detected } = await scan(join(fixtures, 'coverage-url-only'));
    expect(detected.map((d) => d.name)).toContain('agentmail');
    expect(detected.find((d) => d.name === 'agentmail')?.source).toBe('url-patterns');
    expect(coverage).toBeUndefined();
  });
});
