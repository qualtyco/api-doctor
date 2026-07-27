import { Resend } from 'resend';
const resend = new Resend('re_typescript_hardcoded_key_xxxxxxxx');
await resend.emails.send({ from: 'a@b.com', to: 'c@d.com', subject: 'x', html: '<p>x</p>' });
