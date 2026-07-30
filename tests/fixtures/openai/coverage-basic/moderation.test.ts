// Test files are excluded from coverage — moderations.create must not be recorded.
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: 'sk-test-123' });

it('flags harmful content', async () => {
  await openai.moderations.create({ input: 'hello' });
});

declare function it(name: string, fn: () => Promise<void>): void;
