// Test files are excluded from coverage — this call must not be attributed.
import { s2 } from '@/lib/s2';

declare function it(name: string, fn: () => Promise<void>): void;

it('deletes the fixture basin', async () => {
  await s2.basins.delete({ basin: 'telemetry' });
});
