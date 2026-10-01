/**
 * Task7 寻路图模型类型。
 * 使用场景：StandableCache / edges / A* 共用；与 Phase0a §6.2 定稿对齐。
 */

/** 方块格整数坐标（脚下方块或身体占用格） */
export type BlockPos = { x: number; y: number; z: number };

/**
 * 单格谓词结果（缓存条目）。
 * 使用场景：搜索箱内复用，避免重复读 Block API。
 */
export type BlockFlags = {
  /** 身位可占（脚/头净空） */
  passable: boolean;
  /** 顶面可当整格站立支撑 */
  support: boolean;
  /** 伤害/禁入（岩浆等；水可配置） */
  hazard: boolean;
  /**
   * 引擎易误判 / 局部站立面；首版 Walk 勿盲信。
   * 使用场景：活板门/楼梯/梯子等 → 特殊边或 ScriptOverride。
   */
  navMismatch: boolean;
};

/**
 * A* 可站立节点：脚下方块顶面。
 * 节点键通常为下方支撑格的 (x,y,z)，实体脚约在 y+1。
 */
export type StandNode = BlockPos & {
  /** 可选：地板 typeId，调试用 */
  belowTypeId?: string;
};

/** 路径边种类（Phase1 四类） */
export type PathEdgeKind = "Walk" | "Jump1" | "Fall" | "SprintGap";

export type PathEdge = {
  kind: PathEdgeKind;
  from: StandNode;
  to: StandNode;
  cost: number;
};

export type PathResult = {
  ok: boolean;
  nodes: StandNode[];
  edges: PathEdge[];
  reason?: string;
};

/**
 * StandableCache 构造选项。
 * 使用场景：农作搜索箱；waterAsHazard 默认 true（对齐 avoid_water）。
 */
export type StandableCacheOptions = {
  /** 将水视为 hazard（不可站）；默认 true */
  waterAsHazard?: boolean;
};
