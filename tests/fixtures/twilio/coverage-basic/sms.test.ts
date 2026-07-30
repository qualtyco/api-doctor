// Test files are excluded from coverage — messages.create must not be recorded.
import { Twilio } from 'twilio';

const client = new Twilio('ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'auth_token');

it('sends an sms', async () => {
  await client.messages.create({ to: '+15558675310', from: '+15017122661', body: 'hi' });
});

declare function it(name: string, fn: () => Promise<void>): void;
