import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

declare const redis: {
  del(key: string): Promise<void>;
  set(key: string, value: string): Promise<void>;
};

// The catch block never runs: the SDK resolves failures as { data: null, error }
// rather than rejecting. The OTP stays in Redis, the cooldown keeps the user
// locked out, and the caller is told the mail is on its way.
export async function sendOtp(userId: string, email: string, code: string) {
  await redis.set(`otp:${userId}`, code);

  try {
    await resend.emails.send({
      from: 'Acme <otp@acme.com>',
      to: [email],
      subject: 'Your code',
      html: `<p>${code}</p>`,
      idempotencyKey: `otp/${userId}`,
    });
  } catch (error) {
    await redis.del(`otp:${userId}`);
    throw error;
  }
}
