/**
 * Performance instrumentation.
 *
 * - PerfMonitor: smoothed per-frame cost breakdown for the FPS overlay.
 * - Benchmark (`?bench=1`): a fixed stress scenario (all weapons maxed, ~140 enemies at the
 *   5-minute difficulty, invulnerable player) that records frame times for 30 s and reports the
 *   average and 1% low. Gives comparable numbers before/after a change on the same device.
 */

export const BENCH_ENABLED = typeof location !== 'undefined' && new URLSearchParams(location.search).has('bench');
export const BENCH_WARMUP = 3; // seconds ignored while shaders compile and the horde spawns
export const BENCH_DURATION = 30;
export const BENCH_ENEMY_TARGET = 140;
export const BENCH_SURVIVAL_TIME = 300;

export interface BenchResult {
  avgMs: number;
  avgFps: number;
  /** 99th percentile frame time ("1% low"). */
  p99Ms: number;
  frames: number;
  quality: string;
  sceneScale: number;
  sceneDpr: number;
}

export class FrameRecorder {
  private samples: number[] = [];

  public reset() {
    this.samples.length = 0;
  }

  public add(ms: number) {
    this.samples.push(ms);
  }

  public summary(): Pick<BenchResult, 'avgMs' | 'avgFps' | 'p99Ms' | 'frames'> {
    const n = this.samples.length;
    if (n === 0) return { avgMs: 0, avgFps: 0, p99Ms: 0, frames: 0 };
    const sorted = [...this.samples].sort((a, b) => a - b);
    const avgMs = sorted.reduce((sum, v) => sum + v, 0) / n;
    return { avgMs, avgFps: 1000 / avgMs, p99Ms: sorted[Math.min(n - 1, Math.floor(n * 0.99))], frames: n };
  }
}

/** Exponentially smoothed timings, rendered into the FPS overlay a few times per second. */
export class PerfMonitor {
  public simMs = 0;
  public renderMs = 0;
  private lastText = 0;

  public record(simMs: number, renderMs: number) {
    this.simMs += (simMs - this.simMs) * 0.1;
    this.renderMs += (renderMs - this.renderMs) * 0.1;
  }

  /** True at most ~4x per second: DOM text writes every frame would cost more than they show. */
  public shouldUpdateText(now: number): boolean {
    if (now - this.lastText < 250) return false;
    this.lastText = now;
    return true;
  }
}
