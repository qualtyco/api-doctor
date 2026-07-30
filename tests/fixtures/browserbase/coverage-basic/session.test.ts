// Test files are excluded from coverage — projects.list must not be recorded.
import Browserbase from '@browserbasehq/sdk';

const bb = new Browserbase({ apiKey: 'bb_test_123' });

it('lists projects', async () => {
  await bb.projects.list();
});

declare function it(name: string, fn: () => Promise<void>): void;
