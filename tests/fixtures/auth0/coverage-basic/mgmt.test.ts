// Test files are excluded from coverage — clients.list must not be recorded.
import { ManagementClient } from 'auth0';

const management = new ManagementClient({
  domain: 'test-tenant.auth0.com',
  token: 'test-token',
});

it('lists applications', async () => {
  await management.clients.list();
});

declare function it(name: string, fn: () => Promise<void>): void;
