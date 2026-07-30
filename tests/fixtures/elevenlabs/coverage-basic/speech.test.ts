// Test files are excluded from coverage — textToSpeech.convert must not be recorded.
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

const client = new ElevenLabsClient({ apiKey: 'sk_test_123' });

it('converts text to speech', async () => {
  await client.textToSpeech.convert('JBFqnCBsd6RMkjVDRZzb', { text: 'hello' });
});

declare function it(name: string, fn: () => Promise<void>): void;
