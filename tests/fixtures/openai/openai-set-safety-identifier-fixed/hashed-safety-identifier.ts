import { createHash } from 'node:crypto';

export async function runTurn(client: any, model: string, input: any[], workspaceUserId: string) {
  return client.responses.create({
    model,
    input,
    tools: [{ type: 'computer' }],
    safety_identifier: createHash('sha256').update(String(workspaceUserId)).digest('hex'),
  });
}
