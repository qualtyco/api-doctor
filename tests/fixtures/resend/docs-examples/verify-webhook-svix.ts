// docs-example-source: https://resend.com/docs/webhooks/verify-webhooks-requests
// Verbatim "verify manually ... using the Svix libraries" example.
import { Webhook } from 'svix';

const secret = process.env.WEBHOOK_SECRET;

// These were all sent from the server
const headers = {
  'svix-id': 'msg_p5jXN8AQM9LWM0D4loKWxJek',
  'svix-timestamp': '1614265330',
  'svix-signature': 'v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=',
};
const payload = '{"test": 2432232314}';

const wh = new Webhook(secret);
// Throws on error, returns the verified content on success
wh.verify(payload, headers);
