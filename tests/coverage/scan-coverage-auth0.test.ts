import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { scan } from '../../src/scanner.js';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'auth0');

describe('scan() coverage integration — auth0', () => {
  it('collects surface usage across client patterns and applies documented punts', async () => {
    const { coverage, detected, results } = await scan(join(fixtures, 'coverage-basic'));
    // Detection must come from the SDK-adjacent import (jsonwebtoken), not
    // from the auth0.com URL strings — url-patterns detection skips coverage.
    expect(detected.find((d) => d.name === 'auth0')?.source).not.toBe('url-patterns');
    const auth0 = coverage?.find((c) => c.provider === 'auth0');
    expect(auth0).toBeDefined();
    // users.get from the renamed client, oauth.passwordGrant and
    // passwordless.sendEmail from the AuthenticationClient, userBlocks.list
    // via dynamic access on a wrapper import, clients.rotateSecret through
    // the '@/lib/auth0' alias. The reference-only users.delete, the
    // destructured roles.list, the wrong-root db.users.get, and the
    // test-file clients.list must all be absent.
    expect(auth0?.used).toEqual([
      'clients.rotateSecret',
      'oauth.passwordGrant',
      'passwordless.sendEmail',
      'userBlocks.list',
      'users.get',
    ]);
    // The fetch passthrough in renamed-client.ts is the one escape-hatch call.
    expect(auth0?.unknownSdkCalls).toBe(1);
    // Coverage never surfaces as a finding.
    for (const r of results) {
      expect(r.rule).not.toContain('coverage');
    }
  });

  it('omits coverage entirely when detection came from a URL pattern alone', async () => {
    const { coverage, detected } = await scan(join(fixtures, 'coverage-url-only'));
    expect(detected.map((d) => d.name)).toContain('auth0');
    expect(detected.find((d) => d.name === 'auth0')?.source).toBe('url-patterns');
    expect(coverage).toBeUndefined();
  });
});
