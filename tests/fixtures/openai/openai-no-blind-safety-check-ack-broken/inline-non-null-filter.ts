// Distinct manifestation: inline object-property assignment with a
// non-null predicate, instead of a separate variable with a type check.
export function buildComputerCallOutput(item: { pending_safety_checks?: unknown[] }) {
  return {
    acknowledged_safety_checks: (item.pending_safety_checks || []).filter((c) => c !== null),
  };
}
