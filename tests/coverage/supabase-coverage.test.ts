import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { collectCoverage } from '../../src/coverage/collect.js';
import { scan } from '../../src/scanner.js';
import type { DetectedProvider } from '../../src/types.js';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'supabase');

function detectedSupabase(
  files: string[],
  source: DetectedProvider['source'] = 'imports',
): DetectedProvider[] {
  return [{ name: 'supabase', source, checked: true, files }];
}

function contents(entries: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(entries));
}

describe('collectCoverage (supabase)', () => {
  it('attributes only the client-rooted hop of fluent builder chains', () => {
    const files = contents({
      'src/app.ts': `
        import { createClient } from '@supabase/supabase-js';
        const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
        await supabase.from('todos').select('*').eq('user_id', 'u_1').single();
        await supabase.storage.from('avatars').upload('a.png', new Blob([]));
        supabase.channel('room').on('broadcast', { event: 'ping' }, () => {}).subscribe();
        await supabase.schema('analytics').from('events').insert({ name: 'view' });
      `,
    });
    const coverage = collectCoverage(detectedSupabase(['src/app.ts']), files);
    // select/eq/single, upload, on/subscribe, and the post-schema from/insert
    // all pass through an intermediate call: invisible, not even unknown.
    expect(coverage).toEqual([
      {
        provider: 'supabase',
        used: ['channel', 'from', 'schema', 'storage.from'],
        unknownSdkCalls: 0,
      },
    ]);
  });

  it('records nested auth/admin/mfa/functions/realtime namespace paths', () => {
    const files = contents({
      'src/auth.ts': `
        import { createClient } from '@supabase/supabase-js';
        const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!);
        await supabase.auth.signInWithOtp({ email: 'a@b.co' });
        await supabase.auth.mfa.enroll({ factorType: 'totp' });
        await supabase.auth.mfa.webauthn.enroll({});
        await supabase.auth.admin.listUsers();
        await supabase.auth.admin.oauth.listClients();
        await supabase.functions.invoke('summarize', { body: { text: 'hi' } });
        await supabase.realtime.setAuth('token');
      `,
    });
    const coverage = collectCoverage(detectedSupabase(['src/auth.ts']), files);
    expect(coverage?.[0].used).toEqual([
      'auth.admin.listUsers',
      'auth.admin.oauth.listClients',
      'auth.mfa.enroll',
      'auth.mfa.webauthn.enroll',
      'auth.signInWithOtp',
      'functions.invoke',
      'realtime.setAuth',
    ]);
    expect(coverage?.[0].unknownSdkCalls).toBe(0);
  });

  it('verifies clients created by the @supabase/ssr factories', () => {
    const files = contents({
      'src/browser.ts': `
        import { createBrowserClient } from '@supabase/ssr';
        const supabase = createBrowserClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
        await supabase.auth.getSession();
      `,
    });
    const coverage = collectCoverage(detectedSupabase(['src/browser.ts']), files);
    expect(coverage?.[0].used).toEqual(['auth.getSession']);
  });

  it('trusts wrapper imports that resolve to a module verifiably exporting a client', () => {
    const files = contents({
      'src/lib/supabase.ts': `
        import { createClient } from '@supabase/supabase-js';
        export const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
      `,
      'src/route.ts': `
        import { supabase } from '@/lib/supabase';
        await supabase.rpc('archive_old_messages', { days: 30 });
      `,
    });
    const coverage = collectCoverage(detectedSupabase(['src/lib/supabase.ts']), files);
    expect(coverage?.[0].used).toEqual(['rpc']);
  });

  it('counts config-chain helpers on a verified client as unknown, never used', () => {
    const files = contents({
      'src/config.ts': `
        import { createClient } from '@supabase/supabase-js';
        const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
        supabase.storage.setHeader('x-application-name', 'acme');
        supabase.storage.throwOnError();
        await supabase.storage.listBuckets();
      `,
    });
    const coverage = collectCoverage(detectedSupabase(['src/config.ts']), files);
    expect(coverage?.[0].used).toEqual(['storage.listBuckets']);
    expect(coverage?.[0].unknownSdkCalls).toBe(2);
  });

  it('skips coverage entirely for url-pattern-only detection', () => {
    const files = contents({
      'src/raw.ts': `await fetch('https://xyzcompany.supabase.co/rest/v1/messages?select=*');`,
    });
    const coverage = collectCoverage(detectedSupabase(['src/raw.ts'], 'url-patterns'), files);
    expect(coverage).toBeUndefined();
  });
});

describe('scan() coverage integration (supabase)', () => {
  it('collects surface usage across client patterns and applies documented punts', async () => {
    const { coverage, results } = await scan(join(fixtures, 'coverage-basic'));
    expect(coverage).toHaveLength(1);
    expect(coverage?.[0].provider).toBe('supabase');
    // from/channel/storage.from from fluent chains (builder stages invisible),
    // auth.signInWithPassword + rpc + functions.invoke from the wrapper
    // consumer, auth.admin.createUser via the renamed constructor,
    // auth.getUser via @supabase/ssr, storage.listBuckets via dynamic access.
    // The reference-only auth.signOut, the destructured auth.getSession, the
    // wrong-root legacyDb.from, and the test-file channel/removeAllChannels
    // must all be absent.
    expect(coverage?.[0].used).toEqual([
      'auth.admin.createUser',
      'auth.getUser',
      'auth.signInWithPassword',
      'channel',
      'from',
      'functions.invoke',
      'rpc',
      'storage.from',
      'storage.listBuckets',
    ]);
    // punts.ts calls storage.setHeader — verified client, outside the surface.
    expect(coverage?.[0].unknownSdkCalls).toBe(1);
    // Coverage never surfaces as a finding.
    for (const r of results) {
      expect(r.rule).not.toContain('coverage');
    }
  });

  it('omits coverage entirely when detection came from a URL pattern alone', async () => {
    const { coverage, detected } = await scan(join(fixtures, 'coverage-url-only'));
    expect(detected.map((d) => d.name)).toContain('supabase');
    expect(detected.find((d) => d.name === 'supabase')?.source).toBe('url-patterns');
    expect(coverage).toBeUndefined();
  });
});
