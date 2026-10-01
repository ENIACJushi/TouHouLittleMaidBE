/**
 * 搜索箱内方块谓词缓存（支撑 / 穿过 / 危险 / NavMismatch）。
 * 使用场景：Task7 A* / canReach；按 dimension+填充范围复用，避免重复 getBlock。
 *
 * 公式唯一来源：Phase0a §6.2 + blockPredicates.ts。
 * 后置 TODO：栅栏顶部局部站立面随连接状态变化。
 */
import { Block, Dimension, Vector3 } from "@minecraft/server";
import {
  evalBlockFlags,
  isStandableAt,
  toBlockView,
} from "./blockPredicates";
import { BlockFlags, BlockPos, StandableCacheOptions, StandNode } from "./types";

function posKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

function floorPos(loc: Vector3): BlockPos {
  return {
    x: Math.floor(loc.x),
    y: Math.floor(loc.y),
    z: Math.floor(loc.z),
  };
}

/**
 * 有界搜索箱缓存。
 * 使用场景：一次 Path.find / canReach 内创建，用完丢弃；或同 tick 复用。
 */
export class StandableCache {
  private readonly dim: Dimension;
  private readonly waterAsHazard: boolean;
  private readonly flags = new Map<string, BlockFlags>();
  /** 空气占位：世界外 / 未加载当不可过、不可支撑、非 hazard */
  private static readonly MISSING: BlockFlags = {
    passable: false,
    support: false,
    hazard: false,
    navMismatch: false,
  };

  /**
   * @param dim 维度
   * @param options waterAsHazard 默认 true
   */
  constructor(dim: Dimension, options?: StandableCacheOptions) {
    this.dim = dim;
    this.waterAsHazard = options?.waterAsHazard !== false;
  }

  /** 清空缓存（同实例换搜索箱时） */
  clear(): void {
    this.flags.clear();
  }

  /**
   * 预热轴对齐箱 [min,max]（含端点）。
   * 使用场景：A* 开始前一次性扫搜索箱。
   */
  warmBox(min: BlockPos, max: BlockPos): void {
    const x0 = Math.min(min.x, max.x);
    const x1 = Math.max(min.x, max.x);
    const y0 = Math.min(min.y, max.y);
    const y1 = Math.max(min.y, max.y);
    const z0 = Math.min(min.z, max.z);
    const z1 = Math.max(min.z, max.z);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        for (let z = z0; z <= z1; z++) {
          this.getFlags(x, y, z);
        }
      }
    }
  }

  /**
   * 读单格谓词（未命中则 getBlock 计算并写入）。
   * 使用场景：边生成 / 净空采样。
   */
  getFlags(x: number, y: number, z: number): BlockFlags {
    const key = posKey(x, y, z);
    const hit = this.flags.get(key);
    if (hit) {
      return hit;
    }
    const block = this.dim.getBlock({ x, y, z });
    const flags = block
      ? evalBlockFlags(toBlockView(block), { waterAsHazard: this.waterAsHazard })
      : StandableCache.MISSING;
    this.flags.set(key, flags);
    return flags;
  }

  getFlagsAt(pos: BlockPos): BlockFlags {
    return this.getFlags(pos.x, pos.y, pos.z);
  }

  /**
   * 脚下支撑格 (x,y,z) 是否构成可站立节点（脚在 y+1，头在 y+2）。
   * 使用场景：A* 节点；StandNode 存支撑格坐标。
   */
  isStandableBelow(x: number, y: number, z: number): boolean {
    const below = this.getFlags(x, y, z);
    const foot = this.getFlags(x, y + 1, z);
    const head = this.getFlags(x, y + 2, z);
    return isStandableAt(below, foot, head);
  }

  /**
   * 实体脚部位置 → 是否可站（取脚下支撑格）。
   * 使用场景：起点/终点校验。
   */
  isStandableFeet(feet: Vector3): boolean {
    const f = floorPos(feet);
    return this.isStandableBelow(f.x, f.y - 1, f.z);
  }

  /**
   * 若 (x,y,z) 为可站支撑格则返回 StandNode。
   * 使用场景：邻居枚举。
   */
  tryStandNode(x: number, y: number, z: number): StandNode | undefined {
    if (!this.isStandableBelow(x, y, z)) {
      return undefined;
    }
    return { x, y, z };
  }

  /**
   * 调试：直接对已有 Block 求值（不写缓存）。
   * 使用场景：block_probe 对照锁定公式。
   */
  static evalBlock(block: Block, options?: StandableCacheOptions): BlockFlags {
    return evalBlockFlags(toBlockView(block), {
      waterAsHazard: options?.waterAsHazard !== false,
    });
  }

  /** 当前缓存条目数（性能观察） */
  get size(): number {
    return this.flags.size;
  }
}
