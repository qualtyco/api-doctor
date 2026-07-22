// docs-example-source: https://docs.agentmail.to/knowledge-base/preventing-duplicate-sends
// Draft workflow with deterministic clientId — the canonical at-most-once
// send. Minimal client/inbox setup added; the rest is verbatim.
import { AgentMailClient } from "agentmail";

const client = new AgentMailClient({ apiKey: "am_..." });
declare const inbox: { inboxId: string };

// Create a draft with a deterministic clientId
const draft = await client.inboxes.drafts.create(inbox.inboxId, {
  to: ["customer@example.com"],
  subject: "Order confirmation",
  text: "Your order has been confirmed.",
  html: "<p>Your order has been confirmed.</p>",
  clientId: "order-123-confirmation",
});

// Later, send the draft (only works once, draft is deleted after sending)
const sent = await client.inboxes.drafts.send(inbox.inboxId, draft.draftId);
console.log(sent.messageId);
