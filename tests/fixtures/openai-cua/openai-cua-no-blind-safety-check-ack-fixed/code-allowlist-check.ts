const ALLOWED_SAFETY_CODES = new Set(['malicious_instructions_minor']);

export function acknowledgeSafetyChecks(pendingSafetyChecks: { code?: string }[]) {
  return pendingSafetyChecks.filter((check) => ALLOWED_SAFETY_CODES.has(check.code ?? ''));
}
