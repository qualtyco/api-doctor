import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { collectCoverage } from '../../src/coverage/collect.js';
import { scan } from '../../src/scanner.js';
import type { DetectedProvider } from '../../src/types.js';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'twilio');

function detectedTwilio(
  files: string[],
  source: DetectedProvider['source'] = 'imports',
): DetectedProvider[] {
  return [{ name: 'twilio', source, checked: true, files }];
}

function contents(entries: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(entries));
}

describe('collectCoverage (twilio)', () => {
  it('records methods called on a client constructed from the named Twilio export', () => {
    const files = contents({
      'src/sms.ts': `
        import { Twilio } from 'twilio';
        const client = new Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        await client.messages.create({ to: '+15558675310', from: '+15017122661', body: 'hi' });
      `,
    });
    const coverage = collectCoverage(detectedTwilio(['src/sms.ts']), files);
    expect(coverage).toEqual([
      { provider: 'twilio', used: ['messages.create'], unknownSdkCalls: 0 },
    ]);
  });

  it('verifies the documented default-export factory pattern (twilio(sid, token))', () => {
    const files = contents({
      'src/voice.ts': `
        import twilio from 'twilio';
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        await client.calls.create({ to: '+15558675310', from: '+15017122661', url: 'https://example.com/twiml' });
      `,
    });
    const coverage = collectCoverage(detectedTwilio(['src/voice.ts']), files);
    expect(coverage?.[0].used).toEqual(['calls.create']);
    expect(coverage?.[0].unknownSdkCalls).toBe(0);
  });

  it('verifies CJS namespace requires via new twilio.Twilio(...)', () => {
    const files = contents({
      'src/balance.js': `
        const twilio = require('twilio');
        const client = new twilio.Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        client.balance.fetch().then(console.log);
      `,
    });
    const coverage = collectCoverage(detectedTwilio(['src/balance.js']), files);
    expect(coverage?.[0].used).toEqual(['balance.fetch']);
  });

  it('attributes sid-context chains to the callable accessor path only', () => {
    // client.calls('CA…').update() chains through an intermediate call — the
    // collector sees the inner client.calls('CA…') call and records 'calls';
    // the outer .update() has an unverifiable root and is dropped (not unknown).
    const files = contents({
      'src/redirect.ts': `
        import { Twilio } from 'twilio';
        const client = new Twilio('AC1', 'token');
        await client.calls('CA123').update({ twiml: '<Response><Hangup/></Response>' });
        await client.messages('SM123').fetch();
        await client.messages.get('SM456').remove();
      `,
    });
    const coverage = collectCoverage(detectedTwilio(['src/redirect.ts']), files);
    expect(coverage?.[0].used).toEqual(['calls', 'messages', 'messages.get']);
    expect(coverage?.[0].unknownSdkCalls).toBe(0);
  });

  it('attributes taskrouter chains up to the workspaces accessor, including the domain shortcut', () => {
    const files = contents({
      'src/taskrouter.ts': `
        import { Twilio } from 'twilio';
        const client = new Twilio('AC1', 'token');
        await client.taskrouter.v1.workspaces('WS1').tasks.create({ attributes: '{}' });
        await client.taskrouter.v1.workspaces.list();
        await client.taskrouter.workspaces('WS1').workers.create({ friendlyName: 'w' });
      `,
    });
    const coverage = collectCoverage(detectedTwilio(['src/taskrouter.ts']), files);
    expect(coverage?.[0].used).toEqual([
      'taskrouter.v1.workspaces',
      'taskrouter.v1.workspaces.list',
      'taskrouter.workspaces',
    ]);
    expect(coverage?.[0].unknownSdkCalls).toBe(0);
  });

  it('records nested list resources reached without a sid call', () => {
    const files = contents({
      'src/usage.ts': `
        import { Twilio } from 'twilio';
        const client = new Twilio('AC1', 'token');
        await client.usage.records.daily.list({ limit: 30 });
        await client.sip.domains.create({ domainName: 'example.sip.twilio.com' });
        await client.incomingPhoneNumbers.local.list({ limit: 5 });
      `,
    });
    const coverage = collectCoverage(detectedTwilio(['src/usage.ts']), files);
    expect(coverage?.[0].used).toEqual([
      'incomingPhoneNumbers.local.list',
      'sip.domains.create',
      'usage.records.daily.list',
    ]);
  });

  it('counts transport escape hatches and out-of-scope domains as unknown, never used', () => {
    const files = contents({
      'src/mixed.ts': `
        import { Twilio } from 'twilio';
        const client = new Twilio('AC1', 'token');
        await client.request({ method: 'get', uri: '/2010-04-01/Accounts.json' }); // transport escape hatch
        await client.verify.v2.services.create({ friendlyName: 'otp' });           // out-of-scope domain
        await client.lookups.v2.phoneNumbers('+15558675310').fetch();              // out-of-scope domain
        await client.messages.create({ to: '+15558675310', from: '+15017122661', body: 'hi' });
      `,
    });
    const coverage = collectCoverage(detectedTwilio(['src/mixed.ts']), files);
    expect(coverage?.[0].used).toEqual(['messages.create']);
    expect(coverage?.[0].unknownSdkCalls).toBe(3);
  });

  it('trusts wrapper imports that resolve to a module verifiably exporting a client', () => {
    const files = contents({
      'src/lib/twilio.ts': `
        import { Twilio } from 'twilio';
        export const twilioClient = new Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      `,
      'src/notify.ts': `
        import { twilioClient } from '@/lib/twilio';
        await twilioClient.messages.create({ to: '+15558675310', from: '+15017122661', body: 'hi' });
      `,
    });
    const coverage = collectCoverage(detectedTwilio(['src/lib/twilio.ts']), files);
    expect(coverage?.[0].used).toEqual(['messages.create']);
  });

  it('skips coverage entirely for url-pattern-only detection', () => {
    const files = contents({
      'src/raw.ts': `await fetch('https://api.twilio.com/2010-04-01/Accounts/AC1/Messages.json');`,
    });
    const coverage = collectCoverage(detectedTwilio(['src/raw.ts'], 'url-patterns'), files);
    expect(coverage).toBeUndefined();
  });
});

describe('scan() coverage integration (twilio)', () => {
  it('collects surface usage across client patterns and applies documented punts', async () => {
    const { coverage, results } = await scan(join(fixtures, 'coverage-basic'));
    expect(coverage).toHaveLength(1);
    expect(coverage?.[0].provider).toBe('twilio');
    // messages.create via the aliased wrapper import, calls + calls.create from
    // the renamed constructor, taskrouter.v1.workspaces + usage.records.daily.list
    // from the default-export factory client, messages.list via dynamic access.
    // The reference-only messages.create, the destructured messages.list, the
    // wrong-root plain object, the untraced require()-factory client, and the
    // test-file messages.create must all be absent.
    expect(coverage?.[0].used).toEqual([
      'calls',
      'calls.create',
      'messages.create',
      'messages.list',
      'taskrouter.v1.workspaces',
      'usage.records.daily.list',
    ]);
    // The out-of-scope lookups call is counted, never named.
    expect(coverage?.[0].unknownSdkCalls).toBe(1);
    // Coverage never surfaces as a finding.
    for (const r of results) {
      expect(r.rule).not.toContain('coverage');
    }
  });

  it('omits coverage entirely when detection came from a URL pattern alone', async () => {
    const { coverage, detected } = await scan(join(fixtures, 'coverage-url-only'));
    expect(detected.map((d) => d.name)).toContain('twilio');
    expect(detected.find((d) => d.name === 'twilio')?.source).toBe('url-patterns');
    expect(coverage).toBeUndefined();
  });
});
