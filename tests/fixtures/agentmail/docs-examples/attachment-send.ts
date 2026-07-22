// docs-example-source: https://docs.agentmail.to/attachments
// Dual text send with a base64 attachment. Minimal client setup added;
// the rest is verbatim.
import { AgentMailClient } from "agentmail";

const client = new AgentMailClient({ apiKey: "am_..." });

// A simple text file for this example
const fileContent = "This is the content of our report.";
// You must Base64 encode the file content before sending
const encodedContent = Buffer.from(fileContent).toString("base64");

const sentMessage = await client.inboxes.messages.send("reports@agentmail.to", {
  to: ["supervisor@example.com"],
  subject: "Q4 Financial Report",
  text: "Please see the attached report.",
  attachments: [{
    content: encodedContent,
    filename: "Q4-report.txt",
    contentType: "text/plain",
  }],
});
console.log(sentMessage.messageId);
