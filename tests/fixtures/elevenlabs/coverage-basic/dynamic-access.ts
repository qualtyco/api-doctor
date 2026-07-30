import { elevenlabs } from './lib/elevenlabs';

export async function findNarrators(query: string) {
  const page = await elevenlabs['voices']['search']({ search: query, pageSize: 10 });
  return page.voices;
}
