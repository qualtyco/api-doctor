import { resend } from './lib/resend';

export async function checkDelivery(emailId: string) {
  const { data } = await resend['emails']['get'](emailId);
  return data?.last_event;
}
