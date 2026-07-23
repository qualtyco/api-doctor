// Test files are excluded from coverage — broadcasts.create must not be recorded.
import { Resend } from 'resend';

const resend = new Resend('re_test_123');

it('sends a broadcast', async () => {
  await resend.broadcasts.create({ segmentId: 'seg_1', from: 'a@b.co', subject: 'x', html: '<p/>' });
});

declare function it(name: string, fn: () => Promise<void>): void;
