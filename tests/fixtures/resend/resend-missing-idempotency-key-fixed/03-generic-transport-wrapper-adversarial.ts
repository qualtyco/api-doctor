import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Both subject and body are caller-supplied, so this function cannot know which
// logical operation it is performing and has no name to seed a key with. The
// key belongs at the call sites, where the intent is known.
export async function sendEmail({
  from,
  email,
  subject,
  html,
}: {
  from: string;
  email: string;
  subject: string;
  html: string;
}) {
  return await resend.emails.send({ from, to: email, subject, html });
}

// Same shape with positional parameters and a derived subject.
export async function forward(to: string, subject: string, text: string) {
  return resend.emails.send({
    from: 'Acme <relay@acme.com>',
    to,
    subject: `Fwd: ${subject}`,
    text,
  });
}
