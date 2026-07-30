import { describe, expect, it } from 'vitest';
import { collectCoverage } from '../../src/coverage/collect.js';
import type { DetectedProvider } from '../../src/types.js';

function detectedAuth0(
  files: string[],
  source: DetectedProvider['source'] = 'imports',
): DetectedProvider[] {
  return [{ name: 'auth0', source, checked: true, files }];
}

function contents(entries: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(entries));
}

describe('collectCoverage — auth0', () => {
  it('records methods called on a directly constructed ManagementClient', () => {
    const files = contents({
      'src/users.ts': `
        import { ManagementClient } from 'auth0';
        const management = new ManagementClient({ domain: 'x.auth0.com', token: 't' });
        const { data } = await management.users.get('auth0|123');
      `,
    });
    const coverage = collectCoverage(detectedAuth0(['src/users.ts']), files);
    expect(coverage).toEqual([{ provider: 'auth0', used: ['users.get'], unknownSdkCalls: 0 }]);
  });

  it('covers all three client constructors, including single-segment root methods', () => {
    const files = contents({
      'src/auth.ts': `
        import { AuthenticationClient, UserInfoClient } from 'auth0';
        const auth = new AuthenticationClient({ domain: 'x.auth0.com', clientId: 'c' });
        await auth.oauth.clientCredentialsGrant({ audience: 'https://api' });
        const userInfo = new UserInfoClient({ domain: 'x.auth0.com' });
        await userInfo.getUserInfo('access-token');
      `,
    });
    const coverage = collectCoverage(detectedAuth0(['src/auth.ts']), files);
    expect(coverage?.[0].used).toEqual(['getUserInfo', 'oauth.clientCredentialsGrant']);
  });

  it('accepts the auth0/management subpath as an SDK import source', () => {
    const files = contents({
      'src/actions.ts': `
        import { ManagementClient } from 'auth0/management';
        const m = new ManagementClient({ domain: 'x.auth0.com', token: 't' });
        await m.actions.deploy('action-id');
      `,
    });
    const coverage = collectCoverage(detectedAuth0(['src/actions.ts']), files);
    expect(coverage?.[0].used).toEqual(['actions.deploy']);
  });

  it('records deeply nested resource paths', () => {
    const files = contents({
      'src/nested.ts': `
        import { ManagementClient } from 'auth0';
        const m = new ManagementClient({ domain: 'x.auth0.com', token: 't' });
        await m.users.authenticationMethods.list('auth0|1');
        await m.guardian.factors.duo.settings.get();
        await m.organizations.members.roles.list('org_1', 'auth0|1');
      `,
    });
    const coverage = collectCoverage(detectedAuth0(['src/nested.ts']), files);
    expect(coverage?.[0].used).toEqual([
      'guardian.factors.duo.settings.get',
      'organizations.members.roles.list',
      'users.authenticationMethods.list',
    ]);
  });

  it('counts the fetch passthrough and undocumented methods as unknown SDK calls', () => {
    const files = contents({
      'src/lowlevel.ts': `
        import { ManagementClient } from 'auth0';
        const m = new ManagementClient({ domain: 'x.auth0.com', token: 't' });
        await m.fetch('https://x.auth0.com/api/v2/stats/active-users'); // transport escape hatch
        await m.users.futureMethod({});                                 // SDK drift
        await m.logs.list();                                            // documented
      `,
    });
    const coverage = collectCoverage(detectedAuth0(['src/lowlevel.ts']), files);
    expect(coverage?.[0].used).toEqual(['logs.list']);
    expect(coverage?.[0].unknownSdkCalls).toBe(2);
  });

  it('trusts wrapper imports that resolve to a module verifiably exporting a client', () => {
    const files = contents({
      'src/lib/auth0.ts': `
        import { ManagementClient } from 'auth0';
        export const management = new ManagementClient({ domain: 'x.auth0.com', token: 't' });
      `,
      'src/route.ts': `
        import { management } from '@/lib/auth0';
        await management.users.update('auth0|1', { blocked: true });
      `,
    });
    const coverage = collectCoverage(detectedAuth0(['src/lib/auth0.ts']), files);
    expect(coverage?.[0].used).toEqual(['users.update']);
  });

  it('skips coverage entirely for url-pattern-only detection', () => {
    const files = contents({
      'src/raw.ts': `await fetch('https://x.auth0.com/oauth/token', { method: 'POST' });`,
    });
    const coverage = collectCoverage(detectedAuth0(['src/raw.ts'], 'url-patterns'), files);
    expect(coverage).toBeUndefined();
  });
});
