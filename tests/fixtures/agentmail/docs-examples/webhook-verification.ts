// docs-example-source: https://docs.agentmail.to/webhook-verification
/**
 * AgentMail Webhook Verification — copy into Cursor/Claude.
 *
 * Use Svix: npm install svix. Secret from webhooks.get(id).secret.
 * Use express.raw({ type: "application/json" }) — NOT express.json(). Verify before parsing.
 */
import express from "express";
import { Webhook } from "svix";

const app = express();
const secret = process.env.AGENTMAIL_WEBHOOK_SECRET;
if (!secret) {
  throw new Error("AGENTMAIL_WEBHOOK_SECRET environment variable is required");
}

app.post("/webhooks", express.raw({ type: "application/json" }), (req, res) => {
  try {
    const wh = new Webhook(secret);
    const msg: any = wh.verify(req.body, req.headers as Record<string, string>);
    if (msg.event_type === "message.received") { /* process */ }
    res.status(204).send();
  } catch {
    res.status(400).send();
  }
});
