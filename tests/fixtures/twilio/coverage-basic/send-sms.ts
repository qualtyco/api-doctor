import { twilioClient } from '@/lib/twilio';

export async function sendSms(to: string, body: string) {
  return twilioClient.messages.create({ to, from: '+15017122661', body });
}
