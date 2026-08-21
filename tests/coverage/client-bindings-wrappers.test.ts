import { describe, expect, it } from 'vitest';
import { collectClientBindings } from '../../src/coverage/collect.js';
import type { DetectedProvider } from '../../src/types.js';

/**
 * Client identity through the two wrapper shapes real projects use to share a
 * client: a barrel that re-exports it, and a path alias that names the module.
 *
 * Both were once read as positive evidence that the binding was NOT a client
 * (`no`), which the gate turns into a blanket suppression — so a compatibility
 * finding claiming a call throws at runtime was dropped precisely in the files
 * with the most SDK evidence. `no` is the assertion that matters here: `yes` is
 * a bonus tier, but a wrongly denied binding silences every rule on it.
 */

const CLIENT = `
  import { createClient } from '@supabase/supabase-js';
  export const supabase = createClient('https://x.supabase.co', 'key');
`;

function bindings(files: Record<string, string>, evidence: string[]) {
  const detected: DetectedProvider[] = [
    { name: 'supabase', source: 'imports', checked: true, files: evidence },
  ];
  return collectClientBindings(detected, new Map(Object.entries(files)))['supabase'] ?? {};
}

describe('collectClientBindings — wrapper modules', () => {
  it('follows `export *` through a barrel', () => {
    const out = bindings(
      {
        'src/lib/client.ts': CLIENT,
        'src/lib/index.ts': `export * from './client';`,
        'src/app.ts': `
          import { supabase } from './lib';
          import { RealtimeSubscription } from '@supabase/supabase-js';
          export async function f(s: RealtimeSubscription) { await supabase.removeSubscription(s); }
        `,
      },
      ['src/lib/client.ts', 'src/app.ts'],
    );
    expect(out['src/app.ts']?.no ?? []).not.toContain('supabase');
    expect(out['src/app.ts']?.yes ?? []).toContain('supabase');
  });

  it('follows a named re-export, including a rename', () => {
    const out = bindings(
      {
        'src/lib/client.ts': CLIENT,
        'src/lib/index.ts': `export { supabase as db } from './client';`,
        'src/app.ts': `
          import { db } from './lib';
          import { RealtimeSubscription } from '@supabase/supabase-js';
          export async function f(s: RealtimeSubscription) { await db.removeSubscription(s); }
        `,
      },
      ['src/lib/client.ts', 'src/app.ts'],
    );
    expect(out['src/app.ts']?.no ?? []).not.toContain('db');
    expect(out['src/app.ts']?.yes ?? []).toContain('db');
  });

  it('follows a chain of barrels', () => {
    const out = bindings(
      {
        'src/lib/client.ts': CLIENT,
        'src/lib/index.ts': `export * from './client';`,
        'src/index.ts': `export * from './lib';`,
        'src/app.ts': `
          import { supabase } from '.';
          import { RealtimeSubscription } from '@supabase/supabase-js';
          export async function f(s: RealtimeSubscription) { await supabase.removeSubscription(s); }
        `,
      },
      ['src/lib/client.ts', 'src/app.ts'],
    );
    expect(out['src/app.ts']?.no ?? []).not.toContain('supabase');
  });

  it('does not deny a client imported through a sigil-less path alias', () => {
    const out = bindings(
      {
        'src/utils/client.ts': CLIENT,
        'src/utils/index.ts': `export * from './client';`,
        'src/app.ts': `
          import { supabase } from 'utils';
          import { RealtimeSubscription } from '@supabase/supabase-js';
          export async function f(s: RealtimeSubscription) { await supabase.removeSubscription(s); }
        `,
      },
      ['src/utils/client.ts', 'src/app.ts'],
    );
    expect(out['src/app.ts']?.no ?? []).not.toContain('supabase');
  });

  it('still denies a binding imported from another vendor package', () => {
    const out = bindings(
      {
        'src/client.ts': CLIENT,
        'src/app.ts': `
          import { createClient } from '@supabase/supabase-js';
          import { emitter } from 'some-event-lib';
          const supabase = createClient('https://x.supabase.co', 'key');
          export function f(s: any) { emitter.removeSubscription(s); }
        `,
      },
      ['src/client.ts', 'src/app.ts'],
    );
    expect(out['src/app.ts']?.no ?? []).toContain('emitter');
  });

  it('does not forward individual names through `export * as ns`', () => {
    const out = bindings(
      {
        'src/lib/client.ts': CLIENT,
        'src/lib/index.ts': `export * as sb from './client';`,
        'src/app.ts': `
          import { supabase } from './lib';
          import { RealtimeSubscription } from '@supabase/supabase-js';
          export async function f(s: RealtimeSubscription) { await supabase.removeSubscription(s); }
        `,
      },
      ['src/lib/client.ts', 'src/app.ts'],
    );
    expect(out['src/app.ts']?.yes ?? []).not.toContain('supabase');
  });
});
