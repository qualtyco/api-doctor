import { bb } from './lib/browserbase';

export async function freshProfile(projectId: string) {
  const context = await bb['contexts']['create']({ projectId });
  return context.id;
}
