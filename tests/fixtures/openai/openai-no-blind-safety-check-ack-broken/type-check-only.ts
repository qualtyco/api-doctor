export function acknowledgeSafetyChecks(pendingSafetyChecks: unknown[]) {
  const acknowledged = pendingSafetyChecks.filter((row) => typeof row === 'object' && row !== null);
  return acknowledged;
}
