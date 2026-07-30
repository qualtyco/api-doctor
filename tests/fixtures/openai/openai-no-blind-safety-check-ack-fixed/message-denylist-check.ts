const DENY_PATTERNS = ['delete', 'transfer funds'];

// Looks like a blanket-acknowledging filter at a glance, but it actually
// inspects each check's message against a denylist before acknowledging.
export function acknowledgeSafetyChecks(pendingSafetyChecks: { message?: string }[]) {
  return pendingSafetyChecks.filter(
    (check) => !DENY_PATTERNS.some((pattern) => (check.message ?? '').includes(pattern)),
  );
}
