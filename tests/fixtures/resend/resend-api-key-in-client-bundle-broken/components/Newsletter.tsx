import { Resend } from 'resend';

// Lives under components/ and renders JSX: bundled to the client even without
// an explicit "use client" directive in some setups.
const resend = new Resend(process.env.RESEND_API_KEY);

export function Newsletter({ email }: { email: string }) {
  async function subscribe() {
    await resend.emails.send({
      from: 'Acme <news@acme.com>',
      to: [email],
      subject: 'Subscribed',
      html: '<p>Thanks for subscribing</p>',
    });
  }

  return <form action={subscribe}><button>Subscribe</button></form>;
}
