// Looks like the broken shape (an undefined check assigning 700), but this
// is a zoom factor, not a vertical scroll delta — out of this rule's scope.
export function normalizeZoom(action: { zoomDelta?: number }) {
  let zoomDelta = action.zoomDelta;
  if (zoomDelta === undefined) {
    zoomDelta = 700;
  }
  return { zoomDelta };
}
