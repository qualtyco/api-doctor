/**
 * Inbound Email Example
 *
 * Demonstrates receiving and forwarding emails using Resend's
 * inbound email feature and webhooks.
 *
 * This is a documentation page: the "webhook handler" below is just a
 * template-literal string rendered inside a <CodeBlock>, not real,
 * executable code. There is no top-level `export function POST` in this
 * file, so the rule must not treat the string's contents as a handler.
 *
 * @see https://resend.com/docs/receive-emails
 */

import { CodeBlock } from '@/components/code-block';
import { PageHeader } from '@/components/page-header';

export default function InboundPage() {
  const webhookCode = `// src/app/api/webhook/route.ts
import { NextResponse } from 'next/server';
import { resend } from '@/lib/resend';

export async function POST(request: Request) {
  const payload = await request.text();

  // IMPORTANT: Always verify webhook signatures!
  const event = resend.webhooks.verify({
    payload,
    headers: {
      'svix-id': request.headers.get('svix-id'),
      'svix-timestamp': request.headers.get('svix-timestamp'),
      'svix-signature': request.headers.get('svix-signature'),
    },
    secret: process.env.RESEND_WEBHOOK_SECRET,
  });

  if (event.type === 'email.received') {
    const { data: email } = await resend.emails.receiving.get(
      event.data.email_id
    );

    await resend.emails.send({
      from: 'System <system@yourdomain.com>',
      to: ['team@yourdomain.com'],
      subject: \`Fwd: \${email.subject}\`,
      html: email.html,
    });
  }

  return NextResponse.json({ received: true });
}`;

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <PageHeader
        title="Inbound Emails"
        description="Receive emails via webhooks and optionally forward them."
        sourcePath="src/app/inbound/page.tsx"
      />
      <CodeBlock code={webhookCode} title="src/app/api/webhook/route.ts" />
    </main>
  );
}
