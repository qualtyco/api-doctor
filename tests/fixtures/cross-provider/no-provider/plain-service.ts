/**
 * No-provider fixture: ordinary application code with patterns that used to
 * cross-fire (generic catch-block substring matching, a hardcoded user id,
 * a mailer facade with an `.emails.send()` shape). With no provider evidence
 * in the file, NO provider's rules may report anything here.
 */
const userId = 'usr_12345';

export async function syncAccount(mailer: any) {
  try {
    await mailer.emails.send({ to: 'ops@example.com', subject: 'sync', html: '<p>ok</p>' });
  } catch (err: any) {
    if (err.message.includes('timeout')) {
      return { retried: true, userId };
    }
    throw err;
  }
}
