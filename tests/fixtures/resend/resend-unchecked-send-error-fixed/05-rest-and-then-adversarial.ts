import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

declare function report(e: unknown): void;

// `error` is captured by the rest element, so the read is unprovable rather
// than absent — the rule must not guess.
export async function sendWithRest(email: string) {
  const { data, ...rest } = await resend.emails.send({
    from: 'Acme <hello@acme.com>',
    to: [email],
    subject: 'Hello',
    html: '<p>Hi</p>',
    idempotencyKey: `hello/${email}`,
  });

  if (rest.error) report(rest.error);
  return data;
}

// A promise chain handles the result; following it is out of scope.
export function sendChained(email: string) {
  resend.emails
    .send({
      from: 'Acme <hello@acme.com>',
      to: [email],
      subject: 'Hello',
      html: '<p>Hi</p>',
      idempotencyKey: `hello/${email}`,
    })
    .then(({ error }) => {
      if (error) report(error);
    });
}
