import express from 'express';
import twilio from 'twilio';

// Express (not Fastify) manifestation: no TwiML built here — the route is
// identified as a Twilio webhook by the distinctive callback body fields it
// reads (MessageSid/MessageStatus) — and nothing validates the signature.
const app = express();
app.use(express.urlencoded({ extended: false }));

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

app.post('/sms/status', async (req, res) => {
  const messageSid = req.body.MessageSid;
  const status = req.body.MessageStatus;
  if (status === 'failed' || status === 'undelivered') {
    const message = await client.messages(messageSid).fetch();
    console.error(`delivery failure for ${messageSid}: ${message.errorCode}`);
  }
  res.sendStatus(204);
});

export default app;
