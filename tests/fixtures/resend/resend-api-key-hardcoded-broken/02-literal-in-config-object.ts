import { Resend } from 'resend';

// Key tucked inside a config object instead of the environment.
const config = {
  apiKey: `re_live_9f8E7d6C5b4A3210zyxw`,
  fromName: 'Acme',
};

export const resend = new Resend(config.apiKey);

export async function sendNotification(to: string, message: string) {
  return resend.emails.send({
    from: 'Acme <alerts@acme.com>',
    to: [to],
    subject: 'Notification',
    html: `<p>${message}</p>`,
  });
}
