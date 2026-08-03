/**
 * Wrapper-import fixture: the Resend client comes from a project wrapper
 * module, not the SDK directly. The named-tier fallback must still attribute
 * the send call to Resend — wrapper-heavy codebases keep their coverage.
 */
import { resend } from './lib/resend';

export async function sendInvite(email: string) {
  // Missing idempotencyKey — must still be flagged despite the wrapper import.
  await resend.emails.send({
    from: 'invites@example.com',
    to: email,
    subject: 'You are invited',
    html: '<p>Join us</p>',
  });
}
