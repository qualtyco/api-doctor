/**
 * End-to-end contract for the provider gate's cross-file behavior: the CLI's
 * client-binding resolution (coverage/collect.ts → temp file →
 * API_DOCTOR_CLIENT_MODULES → plugin/client-modules.ts) must keep real
 * findings alive through wrapper modules, and its denial channel must only
 * ever suppress on a positive receiver claim.
 *
 * Each fixture directory is scanned as its own project root.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { scan } from '../src/scanner.js';

const root = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'cross-provider');

describe('cross-file client resolution keeps wrapper-module findings', () => {
  it('flags a mutation on a neutral-named client imported from lib/db.ts', async () => {
    const { results } = await scan(join(root, 'cross-file-client'));
    const hits = results.filter((r) => r.ruleKey === 'supabase-unchecked-mutation-error');
    expect(
      hits.map((h) => h.file),
      'nothing in routes/user.ts names supabase — only the cross-file map can attribute `db`',
    ).toContain('routes/user.ts');
  });
});

describe('denial fires only on a positive receiver claim', () => {
  it('keeps a finding reported inside a higher-order wrapper (Convex-style internalAction)', async () => {
    // The rule reports on the CatchClause. The enclosing-call fallback must
    // not cross the handler's function boundary and attribute the finding to
    // `internalAction(...)`, whose callee is on every provider's non-client
    // list.
    const { results } = await scan(join(root, 'hof-wrapper'));
    const hits = results.filter((r) => r.ruleKey === 'agentmail-handle-send-failure-status');
    expect(hits.map((h) => h.file)).toContain('followups.ts');
  });

  it('keeps a data-flow finding whose reported call belongs to someone else', async () => {
    // id-token-cookie-flags flags `setCookie(...)` — a bare call from a
    // non-client module. The finding is about the Firebase ID token flowing
    // into an unflagged cookie; foreign attribution of `setCookie` itself is
    // not contrary evidence.
    const { results } = await scan(join(root, 'data-flow-denial'));
    const hits = results.filter((r) => r.ruleKey === 'firebase-id-token-cookie-flags');
    expect(hits.map((h) => h.file)).toContain('session.ts');
  });

  it('still suppresses the identical shape on a traced look-alike, keeping the real one', async () => {
    const { results } = await scan(join(root, 'lookalike-orm'));
    const hits = results.filter((r) => r.ruleKey === 'supabase-unchecked-mutation-error');
    expect(hits, 'exactly the supabase.from(...) mutation, never the orm.from(...) one').toHaveLength(1);
    expect(hits[0].file).toBe('service.ts');
    expect(hits[0].snippet).toContain('supabase');
  });
});

describe('identifier-position anchor evidence', () => {
  it('flags a Media Streams protocol file that never imports twilio', async () => {
    // The file's only twilio tell is the `streamSid` fields it reads and
    // writes — matched by the twilio anchor's identifierPattern.
    const { results } = await scan(join(root, 'twilio-protocol'));
    const hits = results.filter((r) => r.ruleKey === 'twilio-media-streams-mark-name-string');
    expect(hits.map((h) => h.file)).toContain('stream-socket.ts');
  });
});
