// Correct: webhook registration + Svix-verified consumer — no polling.
import express from 'express';
import { Webhook } from 'svix';
import { AgentMailClient } from 'agentmail';
import { enqueue } from './queue.js';

const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

export async function registerWebhook(url: string): Promise<string> {
  const webhook = await client.webhooks.create({
    url,
    events: ['message.received'],
    clientId: 'inbound-webhook-v1',
  });
  return webhook.secret;
}

export function buildApp(secret: string): express.Express {
  const app = express();
  app.post('/webhooks', express.raw({ type: 'application/json' }), (req, res) => {
    try {
      const wh = new Webhook(secret);
      const msg: any = wh.verify(req.body, req.headers as Record<string, string>);
      if (msg.event_type === 'message.received') enqueue(msg); // 2xx now, work later
      res.status(204).send();
    } catch {
      res.status(400).send();
    }
  });
  return app;
}
