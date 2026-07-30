import express from 'express';
import Stripe from 'stripe';

// False-positive regression (audit: 662/706 FPs): a POST route reading the
// request body that has nothing to do with Twilio. No twilio import, no
// TwiML, no Twilio body fields — must never be flagged for a missing
// X-Twilio-Signature check.
const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), (req, res) => {
  const event = stripe.webhooks.constructEvent(
    req.body,
    req.headers['stripe-signature'] as string,
    process.env.STRIPE_WEBHOOK_SECRET!,
  );
  if (event.type === 'checkout.session.completed') {
    console.log('checkout completed', event.id);
  }
  res.json({ received: true });
});

export default app;
