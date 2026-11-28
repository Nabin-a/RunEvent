/**
 * Where a drop lands in a vertical list, from the pointer: the nearest top or bottom edge of
 * the boxes (distance to the edge segment, or to its corner when the pointer is beside it).
 * Gaps between boxes, margins and spots beside a column all resolve to the nearest edge, so
 * there is no dead zone. Bottom edge = after the box. Returns the insert index (0..boxes.length).
 * The idea follows the block editor research in docs/page-editor-dnd-research.md (own code).
 */
export interface EdgeBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

const distanceToRow = (p: { x: number; y: number }, x1: number, x2: number, y: number) => {
  const dx = p.x < x1 ? x1 - p.x : p.x > x2 ? p.x - x2 : 0;
  return Math.hypot(dx, p.y - y);
};

export function nearestInsertIndex(boxes: EdgeBox[], p: { x: number; y: number }): number {
  let best = Infinity;
  let at = 0;
  boxes.forEach((b, i) => {
    const top = distanceToRow(p, b.left, b.left + b.width, b.top);
    const bottom = distanceToRow(p, b.left, b.left + b.width, b.top + b.height);
    if (top < best) {
      best = top;
      at = i;
    }
    if (bottom < best) {
      best = bottom;
      at = i + 1;
    }
  });
  return at;
}

/** a thin horizontal line between two neighbours (or just above / below the only one) */
export function lineBetween(prev: EdgeBox | undefined, next: EdgeBox | undefined, span: EdgeBox): EdgeBox | null {
  if (!prev && !next) return null;
  const y = prev && next ? (prev.top + prev.height + next.top) / 2 : next ? next.top - 6 : (prev as EdgeBox).top + (prev as EdgeBox).height + 6;
  return { top: y - 1.5, left: span.left, width: span.width, height: 3 };
}
