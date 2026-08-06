import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Two results in one scope force a rename. Matching on the local binding name
// instead of the destructured property would flag both of these.
export async function sendPair(admin: string, user: string, ticketId: string) {
  const { error: adminError } = await resend.emails.send({
    from: 'Acme <alerts@acme.com>',
    to: [admin],
    subject: 'New ticket',
    html: '<p>Ticket opened</p>',
    idempotencyKey: `ticket-admin/${ticketId}`,
  });
  if (adminError) throw new Error(adminError.message);

  const { error: userError } = await resend.emails.send({
    from: 'Acme <support@acme.com>',
    to: [user],
    subject: 'We got your ticket',
    html: '<p>Thanks</p>',
    idempotencyKey: `ticket-user/${ticketId}`,
  });
  if (userError) throw new Error(userError.message);
}
