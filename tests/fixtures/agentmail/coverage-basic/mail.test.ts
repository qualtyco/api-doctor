// Test files are excluded from coverage — inboxes.create must not be recorded.
import { AgentMailClient } from 'agentmail';

const client = new AgentMailClient({ apiKey: 'am_test_123' });

it('creates an inbox', async () => {
  await client.inboxes.create({ clientId: 'test-inbox-v1' });
});

declare function it(name: string, fn: () => Promise<void>): void;
