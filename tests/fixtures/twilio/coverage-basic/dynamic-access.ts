import { twilioClient } from './lib/twilio';

export async function recentMessages() {
  const messages = await twilioClient['messages']['list']({ limit: 20 });
  return messages;
}
