export function acknowledgeSafetyChecks(pendingSafetyChecks: unknown[]) {
  const acknowledged = pendingSafetyChecks.filter((row) => typeof row === 'object' && row !== null);
  return acknowledged;
}

export function checksFor(item: { type: string; pending_safety_checks?: unknown[] }) {
  return item.type === 'computer_call' ? acknowledgeSafetyChecks(item.pending_safety_checks ?? []) : [];
}
