import { s2 } from '@/lib/s2';

export async function listBasins() {
  return s2.basins.list({ limit: 10 });
}

export async function issueIngestToken(expiresAt: Date) {
  const issued = await s2.accessTokens.issue({
    id: `ingest-${Date.now()}`,
    scope: { basins: { exact: 'telemetry' }, opGroups: { stream: { write: true } } },
    expiresAt,
  });
  return issued.accessToken;
}
