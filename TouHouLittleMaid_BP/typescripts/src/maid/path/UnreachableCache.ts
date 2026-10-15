/**
 * 不可达短时缓存（Task7）。
 * 使用场景：Path.follow Fail / canReach 失败后短 ban，避免死循环重试。
 */
import { StandNode } from "./types";

function blockKey(n: StandNode | { x: number; y: number; z: number }): string {
  return `${Math.floor(n.x)},${Math.floor(n.y)},${Math.floor(n.z)}`;
}

/** 默认 ban 时长（毫秒） */
export const UNREACHABLE_TTL_MS = 30_000;

type Entry = { expiry: number };

/**
 * (可选 maidId + 目标格) → 过期时间。
 * 使用场景：Executor Fail；查询时顺带清过期。
 */
export class UnreachableCache {
  private readonly map = new Map<string, Entry>();

  private key(maidId: string | undefined, dest: StandNode): string {
    return `${maidId ?? "*"}|${blockKey(dest)}`;
  }

  /**
   * 标记不可达。
   * @param ttlMs 默认 30s
   */
  add(dest: StandNode, maidId?: string, ttlMs: number = UNREACHABLE_TTL_MS): void {
    this.map.set(this.key(maidId, dest), { expiry: Date.now() + ttlMs });
  }

  /** 是否仍在 ban 期内 */
  has(dest: StandNode, maidId?: string): boolean {
    const k = this.key(maidId, dest);
    const e = this.map.get(k);
    if (!e) {
      return false;
    }
    if (Date.now() > e.expiry) {
      this.map.delete(k);
      return false;
    }
    return true;
  }

  /** 手动解除 */
  remove(dest: StandNode, maidId?: string): void {
    this.map.delete(this.key(maidId, dest));
  }

  clear(): void {
    this.map.clear();
  }

  /**
   * 枚举未过期 ban 终点支撑格（无维度信息，由调用方按当前维刷粒子）。
   * 使用场景：ReachViz「显示路点」品红粒子。
   */
  listActiveDests(): StandNode[] {
    const now = Date.now();
    const out: StandNode[] = [];
    for (const [k, e] of this.map) {
      if (now > e.expiry) {
        this.map.delete(k);
        continue;
      }
      const bar = k.indexOf("|");
      if (bar < 0) {
        continue;
      }
      const coords = k.slice(bar + 1).split(",");
      if (coords.length !== 3) {
        continue;
      }
      const x = Number(coords[0]);
      const y = Number(coords[1]);
      const z = Number(coords[2]);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        continue;
      }
      out.push({ x, y, z });
    }
    return out;
  }
}

/** 进程内单例，供 Path / Executor 共用 */
export const unreachableCache = new UnreachableCache();
