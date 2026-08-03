/**
 * Unit tests for the plugin's client tracker: verified/named/unknown
 * ownership tiers, alias resolution, and negative anchoring across providers.
 * Nodes are minimal ESTree-shaped objects — no parser involved.
 */
import { describe, expect, it } from 'vitest';
import { ALL_ANCHORS } from '../src/plugin/anchors.js';
import { createClientTracker } from '../src/plugin/client-tracker.js';

const id = (name: string) => ({ type: 'Identifier', name });
const lit = (value: string) => ({ type: 'Literal', value });
const member = (object: any, name: string) => ({
  type: 'MemberExpression',
  object,
  property: id(name),
  computed: false,
});
const call = (callee: any, args: any[] = []) => ({ type: 'CallExpression', callee, arguments: args });
const newExpr = (callee: any, args: any[] = []) => ({ type: 'NewExpression', callee, arguments: args });
const importDecl = (source: string, specifiers: any[]) => ({
  type: 'ImportDeclaration',
  source: lit(source),
  specifiers,
});
const namedSpec = (imported: string, local = imported) => ({
  type: 'ImportSpecifier',
  imported: id(imported),
  local: id(local),
});
const defaultSpec = (local: string) => ({ type: 'ImportDefaultSpecifier', local: id(local) });
const declarator = (name: string, init: any) => ({ type: 'VariableDeclarator', id: id(name), init });

function makeTracker() {
  return createClientTracker(ALL_ANCHORS);
}

describe('verified tier', () => {
  it('traces import → construction → variable → chained call', () => {
    const t = makeTracker();
    t.visitors().ImportDeclaration(importDecl('resend', [namedSpec('Resend')]));
    t.visitors().VariableDeclarator(declarator('mailer', newExpr(id('Resend'), [lit('key')])));
    t.finalize();
    const sendCall = call(member(member(id('mailer'), 'emails'), 'send'));
    expect(t.resolveOwner(sendCall)).toEqual({ tier: 'verified', provider: 'resend' });
    expect(t.belongsTo(sendCall, 'resend')).toBe(true);
    expect(t.belongsTo(sendCall, 'browserbase')).toBe(false);
  });

  it('resolves aliases to the constructed client', () => {
    const t = makeTracker();
    t.visitors().ImportDeclaration(importDecl('@browserbasehq/sdk', [defaultSpec('Browserbase')]));
    t.visitors().VariableDeclarator(declarator('bb', newExpr(id('Browserbase'))));
    t.visitors().VariableDeclarator(declarator('client', id('bb')));
    t.finalize();
    const sessions = call(member(member(id('client'), 'sessions'), 'create'));
    expect(t.resolveOwner(sessions)).toEqual({ tier: 'verified', provider: 'browserbase' });
  });

  it('unwinds fluent call chains to the base client (supabase)', () => {
    const t = makeTracker();
    t.visitors().ImportDeclaration(importDecl('@supabase/supabase-js', [namedSpec('createClient')]));
    t.visitors().VariableDeclarator(declarator('supabase', call(id('createClient'), [lit('url'), lit('key')])));
    t.finalize();
    const chained = call(member(call(member(call(member(id('supabase'), 'from'), [lit('t')]), 'select')), 'single'));
    expect(t.resolveOwner(chained)).toEqual({ tier: 'verified', provider: 'supabase' });
  });
});

describe('named tier (wrapper imports)', () => {
  it('attributes a wrapper-imported binding by name', () => {
    const t = makeTracker();
    t.visitors().ImportDeclaration(importDecl('./lib/resend', [namedSpec('resend')]));
    t.finalize();
    const sendCall = call(member(member(id('resend'), 'emails'), 'send'));
    const owner = t.resolveOwner(sendCall);
    expect(owner).toEqual({ tier: 'named', provider: 'resend' });
    expect(t.belongsTo(sendCall, 'resend')).toBe(true);
  });
});

describe('negative anchoring in mixed files', () => {
  it('a receiver verified as another provider never passes belongsTo', () => {
    const t = makeTracker();
    // Twilio present in the file...
    t.visitors().ImportDeclaration(importDecl('twilio', [defaultSpec('twilio')]));
    t.visitors().VariableDeclarator(declarator('twilioClient', call(id('twilio'), [lit('sid'), lit('tok')])));
    // ...and a browserbase client too.
    t.visitors().ImportDeclaration(importDecl('@browserbasehq/sdk', [defaultSpec('Browserbase')]));
    t.visitors().VariableDeclarator(declarator('bb', newExpr(id('Browserbase'))));
    t.finalize();
    const bbCall = call(member(member(id('bb'), 'sessions'), 'create'));
    // Even though the file HAS twilio evidence (tier-3 would pass), the
    // receiver is verified browserbase — twilio must not claim it.
    expect(t.belongsTo(bbCall, 'twilio')).toBe(false);
    expect(t.belongsTo(bbCall, 'browserbase')).toBe(true);
  });

  it('an unknown receiver falls back to file evidence (tier 3)', () => {
    const t = makeTracker();
    t.visitors().ImportDeclaration(importDecl('twilio', [defaultSpec('twilio')]));
    t.finalize();
    const someCall = call(member(member(id('client'), 'calls'), 'create'));
    // `client` is unverifiable; the file's only SDK evidence is twilio.
    expect(t.belongsTo(someCall, 'twilio')).toBe(true);
    // A provider with no evidence in the file cannot claim it.
    expect(t.belongsTo(someCall, 'browserbase')).toBe(false);
  });
});

describe('file evidence', () => {
  it('URL and token literals count as evidence, imports as direct evidence', () => {
    const t = makeTracker();
    t.visitors().Literal(lit('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview'));
    t.finalize();
    expect(t.hasFileEvidence('openai-realtime')).toBe(true);
    expect(t.hasDirectEvidence('openai-realtime')).toBe(false);
    expect(t.hasFileEvidence('twilio')).toBe(false);
  });
});
