/**
 * Unit tests for the deniedFor semantics of the gate's post-filter, including
 * the CLI-supplied cross-file map (client-modules.ts):
 *
 * - a `yes` entry seeds the verified tier and file evidence;
 * - a `no` entry denies only receiver claims (`x.method(...)` on a traced
 *   non-client), never bare calls or reports the fallback cannot reach
 *   without crossing a function boundary.
 *
 * client-modules.ts caches its map at module load, so each test builds a
 * fresh module graph via vi.resetModules() + dynamic import.
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const consumerPath = resolve('src/__virtual__/consumer.ts');

type MapShape = Record<string, Record<string, { yes: string[]; no: string[] }>>;

async function freshTracker(map: MapShape) {
  const dir = mkdtempSync(join(tmpdir(), 'api-doctor-client-map-'));
  const mapPath = join(dir, 'client-modules.json');
  writeFileSync(mapPath, JSON.stringify(map), 'utf8');
  process.env.API_DOCTOR_CLIENT_MODULES = mapPath;
  vi.resetModules();
  const { createClientTracker } = await import('../src/plugin/client-tracker.js');
  const { ALL_ANCHORS } = await import('../src/plugin/anchors.js');
  return createClientTracker(ALL_ANCHORS, consumerPath);
}

afterEach(() => {
  delete process.env.API_DOCTOR_CLIENT_MODULES;
  vi.resetModules();
});

// Minimal ESTree-shaped nodes; spans only where enclosingCall needs them.
const id = (name: string, span?: [number, number]) => ({
  type: 'Identifier',
  name,
  ...(span ? { start: span[0], end: span[1] } : {}),
});
const lit = (value: string, span?: [number, number]) => ({
  type: 'Literal',
  value,
  ...(span ? { start: span[0], end: span[1] } : {}),
});
const member = (object: any, name: string) => ({
  type: 'MemberExpression',
  object,
  property: id(name),
  computed: false,
});
const call = (callee: any, args: any[] = [], span?: [number, number]) => ({
  type: 'CallExpression',
  callee,
  arguments: args,
  ...(span ? { start: span[0], end: span[1] } : {}),
});

const chainCall = (rootName: string, segments: string[], span?: [number, number]) => {
  let node: any = id(rootName);
  for (const seg of segments.slice(0, -1)) node = call(member(node, seg));
  return call(member(node, segments[segments.length - 1]), [], span);
};

describe('cross-file map: yes entries', () => {
  it('seed the verified tier and file evidence', async () => {
    const t = await freshTracker({ supabase: { 'src/__virtual__/consumer.ts': { yes: ['db'], no: [] } } });
    expect(t.hasFileEvidence('supabase')).toBe(true);
    const mutation = chainCall('db', ['from', 'insert']);
    expect(t.belongsTo(mutation, 'supabase')).toBe(true);
    expect(t.deniedFor(mutation, 'supabase')).toBe(false);
    expect(t.resolveOwner(mutation)).toEqual({ tier: 'verified', provider: 'supabase' });
  });
});

describe('cross-file map: no entries', () => {
  it('deny a method call on a traced non-client receiver', async () => {
    const t = await freshTracker({ supabase: { 'src/__virtual__/consumer.ts': { yes: [], no: ['qb'] } } });
    expect(t.deniedFor(chainCall('qb', ['from', 'insert']), 'supabase')).toBe(true);
  });

  it('never deny a bare call — no receiver, no claim to refute', async () => {
    // `setCookie(token)` was flagged for its arguments (data flow), not as an
    // SDK method call. Tracing the callee to cookies-next proves nothing
    // about the finding.
    const t = await freshTracker({
      firebase: { 'src/__virtual__/consumer.ts': { yes: [], no: ['setCookie'] } },
    });
    expect(t.deniedFor(call(id('setCookie'), [lit('token')]), 'firebase')).toBe(false);
  });

  it('never deny across a function boundary (higher-order wrapper)', async () => {
    const t = await freshTracker({
      agentmail: { 'src/__virtual__/consumer.ts': { yes: [], no: ['internalAction', 'qb'] } },
    });
    const visitors = t.visitors();
    // internalAction({ handler: async () => { …catch…; qb.from().insert() } })
    const outerCall = call(id('internalAction'), [], [0, 200]);
    const handlerFn = { type: 'ArrowFunctionExpression', start: 20, end: 190 };
    const innerCall = chainCall('qb', ['from', 'insert'], [140, 170]);
    visitors.CallExpression(outerCall);
    visitors.CallExpression(innerCall);
    visitors.ArrowFunctionExpression(handlerFn);

    // A CatchClause inside the handler: the only containing call is the
    // wrapper itself, which sits outside the handler's function span — no
    // attribution, no denial.
    const caught = { type: 'CatchClause', start: 100, end: 110 };
    expect(t.deniedFor(caught, 'agentmail')).toBe(false);

    // Same file, same function: a report inside qb's own call span still
    // resolves to the traced non-client and is denied.
    const reportInsideInner = lit('signups_audit', [150, 160]);
    expect(t.deniedFor(reportInsideInner, 'agentmail')).toBe(true);
  });
});
