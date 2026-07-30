export function normalizeScroll(action: { dx?: number; dy?: number }) {
  let dx = action.dx;
  let dy = action.dy;

  if (dx === undefined) {
    dx = 0;
  }
  if (dy === undefined) {
    dy = 700;
  }

  return { dx, dy };
}

export function scrollDeltasFor(item: { type: string; action: any }) {
  return item.type === 'computer_call' ? normalizeScroll(item.action) : null;
}
