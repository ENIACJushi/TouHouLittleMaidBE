/**
 * 方案 D：进程内共享 StandableCache 租约（ROI + 短 TTL）。
 * 使用场景：同片农田多次 Path.find / 可达场构建复用 warm，少重复 getBlock。
 */
import { Dimension } from "@minecraft/server";
import { StandableCache, clampBoundsToDimension } from "./StandableCache";
import { BlockPos, StandableCacheOptions } from "./types";

/** 共享 Standable 默认存活（毫秒） */
export const SHARED_STANDABLE_TTL_MS = 3_000;

/**
 * 租约句柄：用完须 release（仅减引用；过期由 TTL/invalidate 回收）。
 * 使用场景：Path.runFind / ReachabilityField.ensure。
 */
export type SharedStandableLease = {
  cache: StandableCache;
  /** 租约键（dim+箱+选项） */
  key: string;
  /** 本次 acquire 是否执行了 warmBox */
  didWarm: boolean;
  release: () => void;
};

type LeaseRecord = {
  cache: StandableCache;
  dimId: string;
  min: BlockPos;
  max: BlockPos;
  waterAsHazard: boolean;
  expires: number;
  refCount: number;
  /** 累计 warm 次数（探针：同 ROI 复用时应不再增加） */
  warmCount: number;
};

const leases = new Map<string, LeaseRecord>();

/**
 * 生成 ROI 租约键。
 * 使用场景：acquire / invalidate 对齐同一箱。
 */
export function sharedStandableKey(
  dimId: string,
  min: BlockPos,
  max: BlockPos,
  waterAsHazard: boolean
): string {
  return `${dimId}|${min.x},${min.y},${min.z}|${max.x},${max.y},${max.z}|wah=${waterAsHazard ? 1 : 0}`;
}

function sweepExpired(now: number): void {
  for (const [k, rec] of leases) {
    if (rec.refCount <= 0 && now > rec.expires) {
      leases.delete(k);
    }
  }
}

/**
 * 取得（或创建）已 warm 的共享 StandableCache。
 * 使用场景：Path.find 搜索箱；ReachabilityField 建场。
 */
export function acquireSharedStandable(
  dim: Dimension,
  min: BlockPos,
  max: BlockPos,
  options?: StandableCacheOptions & { ttlMs?: number }
): SharedStandableLease {
  const now = Date.now();
  sweepExpired(now);
  const box = clampBoundsToDimension(dim, min, max);
  const waterAsHazard = options?.waterAsHazard !== false;
  const ttlMs = options?.ttlMs ?? SHARED_STANDABLE_TTL_MS;
  const key = sharedStandableKey(dim.id, box.min, box.max, waterAsHazard);
  let rec = leases.get(key);
  let didWarm = false;
  if (!rec || now > rec.expires) {
    const cache = new StandableCache(dim, { waterAsHazard });
    if (box.min.y <= box.max.y) {
      cache.warmBox(box.min, box.max);
      didWarm = true;
    }
    rec = {
      cache,
      dimId: dim.id,
      min: { ...box.min },
      max: { ...box.max },
      waterAsHazard,
      expires: now + ttlMs,
      refCount: 0,
      warmCount: didWarm ? 1 : 0,
    };
    leases.set(key, rec);
  } else {
    // 命中：续期，不重复 warm
    rec.expires = now + ttlMs;
  }
  rec.refCount++;
  return {
    cache: rec.cache,
    key,
    didWarm,
    release: () => {
      const cur = leases.get(key);
      if (!cur) {
        return;
      }
      cur.refCount = Math.max(0, cur.refCount - 1);
    },
  };
}

/**
 * 丢弃匹配的共享 Standable（整维或指定箱）。
 * 使用场景：ROI 脏；可达场 invalidate。
 */
export function invalidateSharedStandable(
  dimId: string,
  min?: BlockPos,
  max?: BlockPos
): void {
  if (min && max) {
    // 精确键与同维相交箱都丢（保守：同维全部丢更简单且正确）
    for (const [k, rec] of leases) {
      if (rec.dimId !== dimId) {
        continue;
      }
      if (boxesEqual(rec.min, rec.max, min, max) || boxesOverlap(rec.min, rec.max, min, max)) {
        leases.delete(k);
      }
    }
    return;
  }
  for (const [k, rec] of leases) {
    if (rec.dimId === dimId) {
      leases.delete(k);
    }
  }
}

function boxesEqual(
  aMin: BlockPos,
  aMax: BlockPos,
  bMin: BlockPos,
  bMax: BlockPos
): boolean {
  return (
    aMin.x === bMin.x &&
    aMin.y === bMin.y &&
    aMin.z === bMin.z &&
    aMax.x === bMax.x &&
    aMax.y === bMax.y &&
    aMax.z === bMax.z
  );
}

function boxesOverlap(
  aMin: BlockPos,
  aMax: BlockPos,
  bMin: BlockPos,
  bMax: BlockPos
): boolean {
  return (
    aMin.x <= bMax.x &&
    aMax.x >= bMin.x &&
    aMin.y <= bMax.y &&
    aMax.y >= bMin.y &&
    aMin.z <= bMax.z &&
    aMax.z >= bMin.z
  );
}

/**
 * 调试快照：租约数与 warm 累计。
 * 使用场景：验收「同 ROI 少 warm」。
 */
export function sharedStandableStats(): {
  leases: number;
  totalWarmCount: number;
  totalRefCount: number;
} {
  let totalWarmCount = 0;
  let totalRefCount = 0;
  for (const rec of leases.values()) {
    totalWarmCount += rec.warmCount;
    totalRefCount += rec.refCount;
  }
  return { leases: leases.size, totalWarmCount, totalRefCount };
}

/** 测试用：清空全部租约 */
export function clearSharedStandableForTest(): void {
  leases.clear();
}
