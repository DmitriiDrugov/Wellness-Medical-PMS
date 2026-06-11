/**
 * Deterministic fallback placement for floor-plan tiles (rooms / areas) that have
 * no saved posX/posY yet. Tiles with explicit coordinates are kept as-is; unplaced
 * tiles are shelf-packed into rows `cols` wide, below any already-placed tiles.
 * Pure + unit-tested; shared by the map UI.
 */
export interface Placeable {
  posX: number | null;
  posY: number | null;
  width: number;
  height: number;
}

export function autoPlace<T extends Placeable>(items: T[], cols: number): (T & { posX: number; posY: number })[] {
  const placedBottoms = items.filter((i) => i.posY != null).map((i) => (i.posY ?? 0) + i.height);
  let x = 0;
  let y = placedBottoms.length ? Math.max(...placedBottoms) : 0;
  let rowHeight = 0;

  return items.map((item) => {
    if (item.posX != null && item.posY != null) {
      return { ...item, posX: item.posX, posY: item.posY };
    }
    if (x + item.width > cols) {
      x = 0;
      y += rowHeight;
      rowHeight = 0;
    }
    const placed = { ...item, posX: x, posY: y };
    x += item.width;
    rowHeight = Math.max(rowHeight, item.height);
    return placed;
  });
}
