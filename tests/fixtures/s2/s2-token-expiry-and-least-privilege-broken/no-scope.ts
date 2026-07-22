// No scope object at all: the issued token inherits everything the admin
// token can do, forever.
import { S2, S2Environment } from '@s2-dev/streamstore';

const admin = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function issueBotToken(botId: string) {
  const issued = await admin.accessTokens.issue({
    id: `bot-${botId}`,
  });
  return issued.accessToken;
}
