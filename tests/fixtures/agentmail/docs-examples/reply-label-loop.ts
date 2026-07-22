// docs-example-source: https://docs.agentmail.to/knowledge-base/preventing-duplicate-sends
// Label-tracking reply loop (unreplied → replied). The org-level
// client.threads.get(threadId) single-argument form is the documented API.
// Minimal client/inbox setup added; loop body is verbatim.
import { AgentMailClient } from "agentmail";

const client = new AgentMailClient({ apiKey: "am_..." });
declare const inbox: { inboxId: string };

// Before replying, check if already handled
const threads = await client.inboxes.threads.list(inbox.inboxId, {
  labels: ["unreplied"],
});

for (const thread of threads.threads) {
  const detail = await client.threads.get(thread.threadId);
  const lastMessage = detail.messages[detail.messages.length - 1];

  // Reply and update labels atomically in your logic
  await client.inboxes.messages.reply(inbox.inboxId, lastMessage.messageId, {
    text: "Thanks for reaching out!",
  });

  await client.inboxes.messages.update(inbox.inboxId, lastMessage.messageId, {
    addLabels: ["replied"],
    removeLabels: ["unreplied"],
  });
}
