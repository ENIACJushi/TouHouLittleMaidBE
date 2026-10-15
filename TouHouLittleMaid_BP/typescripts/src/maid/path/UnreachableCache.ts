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
 * (维度 + 可选 maidId + 目标格) → 过期时间。
 * 使用场景：Executor Fail；查询时顺带清过期；按维隔离避免跨维误 ban。
 */
export class UnreachableCache {
  private readonly map = new Map<string, Entry>();

  /**
   * 缓存键：dimId|maidId|x,y,z（dimId / maidId 均不含 `|`）。
   */
  private key(
    dimId: string,
    maidId: string | undefined,
    dest: StandNode
  ): string {
    return `${dimId}|${maidId ?? "*"}|${blockKey(dest)}`;
  }

  /**
   * 标记不可达。
   * @param dimId 目标所在维度 id
   * @param ttlMs 默认 30s
   */
  add(
    dimId: string,
    dest: StandNode,
    maidId?: string,
    ttlMs: number = UNREACHABLE_TTL_MS
  ): void {
    this.map.set(this.key(dimId, maidId, dest), {
      expiry: Date.now() + ttlMs,
    });
  }

  /** 是否仍在 ban 期内（同维度） */
  has(dimId: string, dest: StandNode, maidId?: string): boolean {
    const k = this.key(dimId, maidId, dest);
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
  remove(dimId: string, dest: StandNode, maidId?: string): void {
    this.map.delete(this.key(dimId, maidId, dest));
  }

  clear(): void {
    this.map.clear();
  }

  /**
   * 枚举指定维度内未过期 ban 终点支撑格（按坐标去重）。
   * 使用场景：ReachViz「显示路点」品红粒子。
   */
  listActiveDests(dimId: string): StandNode[] {
    const now = Date.now();
    const seen = new Set<string>();
    const out: StandNode[] = [];
    const prefix = `${dimId}|`;
    for (const [k, e] of this.map) {
      if (now > e.expiry) {
        this.map.delete(k);
        continue;
      }
      if (!k.startsWith(prefix)) {
        continue;
      }
      // dimId|maidId|x,y,z → 取最后一段坐标
      const lastBar = k.lastIndexOf("|");
      if (lastBar < 0) {
        continue;
      }
      const coords = k.slice(lastBar + 1);
      if (seen.has(coords)) {
        continue;
      }
      const parts = coords.split(",");
      if (parts.length !== 3) {
        continue;
      }
      const x = Number(parts[0]);
      const y = Number(parts[1]);
      const z = Number(parts[2]);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        continue;
      }
      seen.add(coords);
      out.push({ x, y, z });
    }
    return out;
  }
}

/** 进程内单例，供 Path / Executor 共用 */
export const unreachableCache = new UnreachableCache();
