export function normalizeScroll(action: { dx?: number; dy?: number }) {
  let dx = action.dx;
  let dy = action.dy;

  if (dx === undefined) {
    dx = 0;
  }
  if (dy === undefined) {
    dy = 0;
  }

  return { dx, dy };
}
