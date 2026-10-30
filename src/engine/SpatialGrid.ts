/**
 * Uniform spatial hash grid, rebuilt once per frame.
 * Turns O(n²) neighbour checks (swarm separation, projectile hits) into ~O(n).
 */
export interface GridItem {
  x: number;
  y: number;
  radius: number;
}

export class SpatialGrid<T extends GridItem> {
  private cells = new Map<number, T[]>();
  private pool: T[][] = [];
  private readonly cellSize: number;
  /** Reused result buffer - copy it if you need to keep results across queries. */
  private result: T[] = [];

  constructor(cellSize: number = 64) {
    this.cellSize = cellSize;
  }

  private key(cx: number, cy: number): number {
    // Arena is ±2400px, so cell coords fit easily into 16 bits each.
    return ((cx + 32768) << 16) | (cy + 32768);
  }

  public rebuild(items: T[]) {
    for (const bucket of this.cells.values()) {
      bucket.length = 0;
      this.pool.push(bucket);
    }
    this.cells.clear();
    const cs = this.cellSize;
    for (const item of items) {
      const k = this.key(Math.floor(item.x / cs), Math.floor(item.y / cs));
      let bucket = this.cells.get(k);
      if (!bucket) {
        bucket = this.pool.pop() ?? [];
        this.cells.set(k, bucket);
      }
      bucket.push(item);
    }
  }

  /** Returns all items whose cell overlaps the circle (x, y, r). Caller does exact checks. */
  public query(x: number, y: number, r: number): T[] {
    const out = this.result;
    out.length = 0;
    const cs = this.cellSize;
    // Items may stick out of their cell by their own radius (max ~40px), so pad the search.
    const pad = r + 40;
    const minX = Math.floor((x - pad) / cs);
    const maxX = Math.floor((x + pad) / cs);
    const minY = Math.floor((y - pad) / cs);
    const maxY = Math.floor((y + pad) / cs);
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const bucket = this.cells.get(this.key(cx, cy));
        if (bucket) {
          for (let i = 0; i < bucket.length; i++) out.push(bucket[i]);
        }
      }
    }
    return out;
  }
}
