import { describe, expect, it } from 'vitest';
import { collectCoverage } from '../../src/coverage/collect.js';
import type { DetectedProvider } from '../../src/types.js';

function detectedResend(
  files: string[],
  source: DetectedProvider['source'] = 'imports',
): DetectedProvider[] {
  return [{ name: 'resend', source, checked: true, files }];
}

function contents(entries: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(entries));
}

describe('collectCoverage', () => {
  it('records methods called on a directly constructed client', () => {
    const files = contents({
      'src/email.ts': `
        import { Resend } from 'resend';
        const resend = new Resend(process.env.RESEND_API_KEY);
        const { data } = await resend.emails.get('49a3999c-0ce1-4ea6-ab68-afcd6dc2e794');
      `,
    });
    const coverage = collectCoverage(detectedResend(['src/email.ts']), files);
    expect(coverage).toEqual([{ provider: 'resend', used: ['emails.get'], unknownSdkCalls: 0 }]);
  });

  it('handles renamed client variables and renamed constructor imports', () => {
    const files = contents({
      'src/mail.ts': `
        import { Resend as MailSdk } from 'resend';
        const r = new MailSdk('re_123');
        await r.emails.send({});
        await r.batch.send([]);
      `,
    });
    const coverage = collectCoverage(detectedResend(['src/mail.ts']), files);
    expect(coverage?.[0].used).toEqual(['batch.send', 'emails.send']);
  });

  it('records dynamic string access the same as dot access', () => {
    const files = contents({
      'src/dynamic.ts': `
        import { Resend } from 'resend';
        const resend = new Resend('re_123');
        await resend["emails"]["send"]({});
      `,
    });
    const coverage = collectCoverage(detectedResend(['src/dynamic.ts']), files);
    expect(coverage?.[0].used).toEqual(['emails.send']);
  });

  it('trusts wrapper imports that resolve to a module verifiably exporting a client', () => {
    const files = contents({
      'src/lib/resend.ts': `
        import { Resend } from 'resend';
        export const resend = new Resend(process.env.RESEND_API_KEY);
      `,
      'src/route.ts': `
        import { resend } from '@/lib/resend';
        await resend.emails.send({});
      `,
    });
    const coverage = collectCoverage(detectedResend(['src/lib/resend.ts']), files);
    expect(coverage?.[0].used).toEqual(['emails.send']);
  });

  it('does not trust a client-looking name when the wrapper module does not export a client', () => {
    const files = contents({
      'src/lib/resend.ts': `
        import { Resend } from 'resend';
        export const client = new Resend('re_1'); // real client under a different export
        export const resend = { emails: { send: async () => ({}) } }; // decoy, not the SDK
      `,
      'src/route.ts': `
        import { resend } from './lib/resend';
        await resend.emails.send({});
      `,
    });
    const coverage = collectCoverage(detectedResend(['src/lib/resend.ts']), files);
    expect(coverage?.[0].used).toEqual([]);
  });

  it('does not trust wrapper imports that cannot be resolved to a scanned module', () => {
    const files = contents({
      'src/lib/resend.ts': `
        import { Resend } from 'resend';
        export const resend = new Resend('re_1');
      `,
      'src/route.ts': `
        import { resend } from '@company/mailer';
        await resend.emails.send({});
      `,
    });
    const coverage = collectCoverage(detectedResend(['src/lib/resend.ts']), files);
    expect(coverage?.[0].used).toEqual([]);
  });

  it('follows the constructor through a one-level barrel re-export', () => {
    const files = contents({
      'src/sdk.ts': `export { Resend } from 'resend';`,
      'src/mail.ts': `
        import { Resend } from './sdk';
        const r = new Resend('re_1');
        await r.emails.list();
      `,
    });
    const coverage = collectCoverage(detectedResend(['src/sdk.ts']), files);
    expect(coverage?.[0].used).toEqual(['emails.list']);
  });

  it('follows simple aliases and this-assigned clients', () => {
    const files = contents({
      'src/service.ts': `
        import { Resend } from 'resend';
        const client = new Resend('re_123');
        const mailer = client;
        await mailer.emails.get('id');
        class MailService {
          resend = new Resend('re_123');
          async cancel(id: string) {
            await this.resend.emails.cancel(id);
          }
        }
      `,
    });
    const coverage = collectCoverage(detectedResend(['src/service.ts']), files);
    expect(coverage?.[0].used).toEqual(['emails.cancel', 'emails.get']);
  });

  it('supports namespace and CommonJS require imports', () => {
    const files = contents({
      'src/ns.ts': `
        import * as sdk from 'resend';
        const a = new sdk.Resend('re_1');
        await a.domains.list();
      `,
      'src/cjs.js': `
        const { Resend } = require('resend');
        const b = new Resend('re_2');
        b.apiKeys.create({ name: 'ci' });
      `,
    });
    const coverage = collectCoverage(detectedResend(['src/ns.ts', 'src/cjs.js']), files);
    expect(coverage?.[0].used).toEqual(['apiKeys.create', 'domains.list']);
  });

  it('counts only calls, not references, and ignores unknown or unrooted paths', () => {
    const files = contents({
      'src/edge.ts': `
        import { Resend } from 'resend';
        const resend = new Resend('re_123');
        const ref = resend.emails.send;            // reference, not a call
        await resend.emails.explode({});           // not a documented method
        const db = { contacts: { create: () => {} } };
        db.contacts.create({});                    // right shape, wrong root
        const { emails } = resend;                 // destructuring is a documented punt
        await emails.send({});
      `,
    });
    const coverage = collectCoverage(detectedResend(['src/edge.ts']), files);
    expect(coverage?.[0].used).toEqual([]);
    // Only the verified-client call outside the surface (emails.explode)
    // counts as unknown; wrong-root and punted calls do not.
    expect(coverage?.[0].unknownSdkCalls).toBe(1);
  });

  it('counts verified-client calls outside the surface manifest as unknown', () => {
    const files = contents({
      'src/lowlevel.ts': `
        import { Resend } from 'resend';
        const resend = new Resend('re_1');
        await resend.post('/broadcasts');          // low-level transport escape hatch
        await resend.emails.futureMethod({});      // SDK drift
        await resend.domains.list();               // documented — used, not unresolved
      `,
    });
    const coverage = collectCoverage(detectedResend(['src/lowlevel.ts']), files);
    expect(coverage?.[0].used).toEqual(['domains.list']);
    expect(coverage?.[0].unknownSdkCalls).toBe(2);
  });

  it('survives a deeply nested AST instead of blowing the stack', () => {
    // A generated template nests one BinaryExpression per `+`. Coverage is
    // informational — it must never be able to fail a scan.
    const chain = Array.from({ length: 8000 }, (_, i) => `"chunk${i}"`).join(' + ');
    const files = contents({
      'src/deep.ts': `
        import { Resend } from 'resend';
        const resend = new Resend('re_1');
        await resend.emails.send({ html: ${chain} });
      `,
    });
    expect(() => collectCoverage(detectedResend(['src/deep.ts']), files)).not.toThrow();
    expect(collectCoverage(detectedResend(['src/deep.ts']), files)?.[0].used).toEqual([
      'emails.send',
    ]);
  });

  it('never throws on unparseable sources — the file is dropped, not the scan', () => {
    const files = contents({
      'src/broken.ts': `import { Resend } from 'resend'; const resend = new Resend( ;;; !!!`,
      'src/ok.ts': `
        import { Resend } from 'resend';
        const resend = new Resend('re_1');
        await resend.domains.list();
      `,
    });
    const coverage = collectCoverage(detectedResend(['src/broken.ts', 'src/ok.ts']), files);
    expect(coverage?.[0].used).toEqual(['domains.list']);
  });

  it('skips coverage entirely for url-pattern-only detection', () => {
    const files = contents({
      'src/raw.ts': `await fetch('https://api.resend.com/emails', { method: 'POST' });`,
    });
    const coverage = collectCoverage(detectedResend(['src/raw.ts'], 'url-patterns'), files);
    expect(coverage).toBeUndefined();
  });

  it('skips providers without a surface manifest', () => {
    const detected: DetectedProvider[] = [
      { name: 'supabase', source: 'imports', checked: true, files: ['src/db.ts'] },
    ];
    const files = contents({ 'src/db.ts': `import { createClient } from '@supabase/supabase-js';` });
    expect(collectCoverage(detected, files)).toBeUndefined();
  });

  it('excludes test files from collection', () => {
    const files = contents({
      'src/email.test.ts': `
        import { Resend } from 'resend';
        const resend = new Resend('re_123');
        await resend.emails.send({});
      `,
    });
    const coverage = collectCoverage(detectedResend(['src/email.test.ts']), files);
    expect(coverage?.[0].used).toEqual([]);
  });

  it('aggregates and sorts usage across files, including nested resource paths', () => {
    const files = contents({
      'src/a.ts': `
        import { Resend } from 'resend';
        const resend = new Resend('re_1');
        await resend.emails.receiving.attachments.list({ emailId: 'x' });
      `,
      'src/b.ts': `
        import { Resend } from 'resend';
        const resend = new Resend('re_1');
        await resend.contacts.segments.add({ segmentId: 's', contactId: 'c' });
        await resend.batch.send([]);
      `,
    });
    const coverage = collectCoverage(detectedResend(['src/a.ts', 'src/b.ts']), files);
    expect(coverage?.[0].used).toEqual([
      'batch.send',
      'contacts.segments.add',
      'emails.receiving.attachments.list',
    ]);
  });
});
