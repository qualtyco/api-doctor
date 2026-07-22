// docs-example-source: https://resend.com/docs/send-with-nextjs
// Verbatim app/api/send/route.ts example (App Router).
// Expected by design: test-only from address, no idempotency key, no tags,
// and the sample maps every Resend error to a blanket HTTP 500.
// docs-example-expected: resend/correctness/test-domain-in-production-path, resend/reliability/missing-idempotency-key, resend/reliability/missing-tags, resend/reliability/no-error-code-mapping
import { EmailTemplate } from '../../../components/email-template';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST() {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Acme <onboarding@resend.dev>',
      to: ['delivered@resend.dev'],
      subject: 'Hello world',
      react: EmailTemplate({ firstName: 'John' }),
    });

    if (error) {
      return Response.json({ error }, { status: 500 });
    }

    return Response.json(data);
  } catch (error) {
    return Response.json({ error }, { status: 500 });
  }
}
