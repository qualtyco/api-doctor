// docs-example-source: https://docs.agentmail.to/quickstart
// docs-example-expected: agentmail/inbox-create-client-id
// The quickstart itself omits clientId on inboxes.create; the same page's
// "copy into Cursor/Claude" block documents clientId as the retry-safe form,
// so the advisory finding is intentional. Text-only send is documented-correct
// and must NOT trigger agentmail/html-requires-text.
import { AgentMailClient } from "agentmail";
import "dotenv/config"; // loads .env file

async function main() {
  // initialize the client
  const client = new AgentMailClient({
    apiKey: process.env.AGENTMAIL_API_KEY,
  });

  // create an inbox
  console.log("Creating inbox...");
  const inbox = await client.inboxes.create(); // domain is optional
  console.log("Inbox created successfully!");
  console.log(inbox);

  // send an email from the new inbox
  console.log("Sending email...");
  await client.inboxes.messages.send(inbox.inboxId, {
    to: "your-email@example.com",
    subject: "Hello from AgentMail!",
    text: "This is my first email sent with the AgentMail API.",
  });
  console.log("Email sent successfully!");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
