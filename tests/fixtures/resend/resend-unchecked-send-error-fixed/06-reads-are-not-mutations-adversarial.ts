import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

declare function cache(key: string, value: unknown): void;

// Discarding the result of a read is dead code, not a silent failure: nothing
// was going to change, so there is no error to miss. Only mutations are in
// scope, and `webhooks.verify` throws rather than returning { data, error }.
export async function warmCaches(emailId: string, payload: string, signature: string) {
  await resend.emails.get(emailId);
  await resend.domains.list();

  const { data } = await resend.audiences.list();
  cache('audiences', data);

  resend.webhooks.verify({ payload, signature });
}
