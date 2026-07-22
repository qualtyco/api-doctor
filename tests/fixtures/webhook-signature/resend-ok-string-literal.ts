import { Resend } from 'resend';

// Not an actual webhook handler. The string merely contains "webhook.verify".
export const note = 'webhook.verify';

export function notAWebhook(req: Request) {
  return new Response(String(req.url));
}

