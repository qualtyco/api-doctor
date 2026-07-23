import { describe, expect, it } from 'vitest';
import { coverageTelemetryProps } from '../../src/telemetry.js';
import type { CoverageCollection } from '../../src/types.js';

describe('coverageTelemetryProps', () => {
  it('namespaces method paths with the provider', () => {
    const entry: CoverageCollection = {
      provider: 'resend',
      used: ['batch.send', 'emails.send'],
      unknownSdkCalls: 2,
    };
    expect(coverageTelemetryProps('resend', entry)).toEqual({
      sdk_used: ['resend.batch.send', 'resend.emails.send'],
      unknown_sdk_calls: 2,
    });
  });

  it('sends an empty array and a zero count when coverage ran but found nothing', () => {
    const entry: CoverageCollection = {
      provider: 'resend',
      used: [],
      unknownSdkCalls: 0,
    };
    expect(coverageTelemetryProps('resend', entry)).toEqual({
      sdk_used: [],
      unknown_sdk_calls: 0,
    });
  });

  it('omits the props entirely when coverage did not run for the provider', () => {
    expect(coverageTelemetryProps('resend', undefined)).toEqual({});
  });
});
