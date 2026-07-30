// Distinct manifestation: nullish-coalescing default instead of an
// if-undefined assignment.
export function normalizeScroll(action: { deltaX?: number; deltaY?: number }) {
  const dx = action.deltaX ?? 0;
  const dy = action.deltaY ?? 700;
  return { dx, dy };
}

export function scrollDeltasFor(item: { type: string; action: any }) {
  return item.type === 'computer_call' ? normalizeScroll(item.action) : null;
}
