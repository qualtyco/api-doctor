import { agentmail } from './lib/agentmail';

export async function readInboundBody(inboxId: string, messageId: string) {
  const message = await agentmail['inboxes']['messages']['get'](inboxId, messageId);
  return message.extractedText ?? message.text;
}
