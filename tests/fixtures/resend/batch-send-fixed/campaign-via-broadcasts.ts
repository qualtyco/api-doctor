import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Adversarial: marketing-named file ("campaign"), but does NOT use batch.send.
// It uses the Broadcasts API (the documented path for marketing), so it must
// not be flagged.
export async function launchCampaign(audienceId: string) {
  return resend.broadcasts.create({
    audienceId,
    from: 'Acme <news@acme.com>',
    subject: 'Big Summer Sale',
    html: '<h1>50% off</h1>{{{RESEND_UNSUBSCRIBE_URL}}}',
  });
}
