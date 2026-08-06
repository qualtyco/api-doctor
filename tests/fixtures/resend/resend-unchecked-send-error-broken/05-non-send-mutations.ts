import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Same contract beyond the send family: a contact that fails to create, or a
// batch that is rejected wholesale, both resolve rather than throw.
export async function subscribe(email: string, audienceId: string) {
  await resend.contacts.create({ email, audienceId, unsubscribed: false });

  await resend.batch.send([
    {
      from: 'Acme <hello@acme.com>',
      to: [email],
      subject: 'Subscribed',
      html: '<p>You are in</p>',
    },
  ]);
}
