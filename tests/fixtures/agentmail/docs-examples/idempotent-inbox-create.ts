// docs-example-source: https://docs.agentmail.to/knowledge-base/preventing-duplicate-sends
// Idempotent inbox creation with a deterministic clientId.
import { AgentMailClient } from "agentmail";

const client = new AgentMailClient({ apiKey: "am_..." });

// Safe to call multiple times: only creates the inbox once
const inbox = await client.inboxes.create({
  username: "support",
  clientId: "support-inbox-v1",
});

// Calling again with the same clientId returns the existing inbox
const sameInbox = await client.inboxes.create({
  username: "support",
  clientId: "support-inbox-v1",
});

// inbox.inboxId === sameInbox.inboxId
console.log(inbox.inboxId === sameInbox.inboxId);
