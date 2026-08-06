import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Returning the result hands { data, error } to the caller, which is where the
// check then belongs. Flagging here would demand the transport itself decide
// how failure is reported — an API design change, not a bug fix.
export async function sendEmail(to: string, subject: string, html: string) {
  return await resend.emails.send({ from: 'Acme <hello@acme.com>', to, subject, html });
}

// Same delegation, written as a concise arrow body.
export const sendRaw = (to: string, subject: string, html: string) =>
  resend.emails.send({ from: 'Acme <hello@acme.com>', to, subject, html });
