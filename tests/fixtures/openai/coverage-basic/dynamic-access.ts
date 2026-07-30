import { openai } from './lib/openai';

export async function embed(input: string) {
  const result = await openai['embeddings']['create']({
    model: 'text-embedding-3-small',
    input,
  });
  return result.data[0].embedding;
}
