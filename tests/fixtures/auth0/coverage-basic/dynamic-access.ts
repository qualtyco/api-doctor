import { management } from './lib/auth0';

export async function listBlocks(userId: string) {
  const { data } = await management['userBlocks']['list'](userId);
  return data;
}
