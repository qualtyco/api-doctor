/**
 * Cross-provider regression fixture: one file using four detected SDKs plus
 * an undetected one (stripe). Each provider's rules must fire only on calls
 * verifiably belonging to that provider's client — never on a neighbor's.
 */
import twilio from 'twilio';
import Browserbase from '@browserbasehq/sdk';
import Stripe from 'stripe';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const twilioClient = twilio('AC000', 'auth-token');
const bb = new Browserbase({ apiKey: 'bb-key' });
const stripe = new Stripe('sk_test');
const resend = new Resend('api-key');
const supabase = createClient('https://project.supabase.co', 'anon-key');

export function registerHandlers(emitter: any) {
  emitter.on('media', async () => {
    // Browserbase call — must NOT be flagged by twilio-await-or-catch.
    await bb.sessions.create({ projectId: 'proj' });
    // Stripe call — must NOT be treated as a Browserbase sessions.create.
    await stripe.checkout.sessions.create({ mode: 'payment' });
    // Real Twilio REST call without try/catch — the one twilio SHOULD flag.
    await twilioClient.calls.create({ to: '+15550100', from: '+15550111', url: 'https://example.com/twiml' });
  });
}

export async function sendWelcome(userId: string) {
  // Resend send without idempotencyKey — resend SHOULD flag exactly this.
  await resend.emails.send({
    from: 'onboarding@example.com',
    to: 'user@example.com',
    subject: 'Welcome',
    html: '<p>Welcome!</p>',
  });
  // Supabase .single() ignoring error — supabase SHOULD flag exactly this.
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
  return data;
}
