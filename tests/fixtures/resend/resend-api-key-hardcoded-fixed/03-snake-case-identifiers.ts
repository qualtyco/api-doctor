import { Resend } from 'resend';

// False-positive regression (audit: 46/47 FPs, dominated by a DB column named
// re_activate_available_at): snake_case identifiers starting with `re_` are
// ordinary words, not Resend keys, and must never be flagged.
const resend = new Resend(process.env.RESEND_API_KEY);

const REACTIVATION_COLUMNS = ['re_activate_available_at', 're_engagement_score', 're_invite_count'];

export async function scheduleReactivation(db: any, userId: string, email: string) {
  await db.query(
    `UPDATE users SET re_activate_available_at = NOW() + INTERVAL '30 days' WHERE id = $1`,
    [userId],
  );
  const row = await db.selectFields('users', REACTIVATION_COLUMNS, userId);
  if (row.re_engagement_score > 0.5) {
    return resend.emails.send({
      from: 'Acme <hello@acme.com>',
      to: [email],
      subject: 'We miss you',
      html: '<p>Come back soon</p>',
    });
  }
}
