/**
 * 可达相关表的粒子可视化（受「显示路点」开关控制）。
 * 使用场景：调试 ReachabilityField / SharedStandable / UnreachableCache。
 *
 * 性能：无轮询；仅在配置初始化/变更时由 Config 调用 setReachVizEnabled。
 * 开启后才挂刷粒子 interval；关闭立即 clearRun。
 *
 * 颜色：
 * - 青绿 path_reach_field：可达场 R(g) 并集（可站且可达只刷此色）
 * - 黄色 path_standable：可站但不在可达场内的格
 * - 品红 path_unreachable：不可达 ban 终点
 * （路点红/绿、轨迹蓝仍由 Executor 负责）
 */
import { Dimension, system, world } from "@minecraft/server";
import { listReachabilityStands } from "./ReachabilityField";
import { listSharedStandablesNear } from "./SharedStandable";
import { unreachableCache } from "./UnreachableCache";
import { StandNode } from "./types";

/** 可达场：青绿 */
const PARTICLE_REACH = "touhou_little_maid:path_reach_field";
/** 共享可站：黄 */
const PARTICLE_STAND = "touhou_little_maid:path_standable";
/** 不可达 ban：品红 */
const PARTICLE_BAN = "touhou_little_maid:path_unreachable";

/** 开启时刷粒子间隔（tick） */
const PAINT_TICKS = 20;
/** 相对观察者水平半径（格） */
const VIEW_H = 28;
/** 相对观察者竖直半高（格） */
const VIEW_V = 12;
/** 快刷循环句柄；undefined=关闭（零常驻成本） */
let paintHandle: number | undefined;

/**
 * 支撑格 → 脚位略抬，便于看见。
 */
function feetPos(n: StandNode): { x: number; y: number; z: number } {
  return { x: n.x + 0.5, y: n.y + 1.05, z: n.z + 0.5 };
}

function inView(
  n: StandNode,
  ox: number,
  oy: number,
  oz: number
): boolean {
  return (
    Math.abs(n.x + 0.5 - ox) <= VIEW_H &&
    Math.abs(n.z + 0.5 - oz) <= VIEW_H &&
    Math.abs(n.y + 1 - oy) <= VIEW_V
  );
}

/**
 * 直接刷粒子（调用方已裁剪，不抽稀）。
 * 使用场景：黄层 listSharedStandablesNear 已按视野箱全量返回。
 */
function spawnAll(
  dim: Dimension,
  particle: string,
  nodes: StandNode[]
): void {
  for (const n of nodes) {
    try {
      dim.spawnParticle(particle as never, feetPos(n));
    } catch {
      /* 未加载区块等 */
    }
  }
}

/**
 * 视野过滤后全量刷粒子（不截断数量）。
 * 使用场景：青绿可达场、品红 ban（全表枚举后按观察者裁切）。
 */
function spawnLayer(
  dim: Dimension,
  particle: string,
  nodes: StandNode[],
  ox: number,
  oy: number,
  oz: number
): void {
  spawnAll(
    dim,
    particle,
    nodes.filter((n) => inView(n, ox, oy, oz))
  );
}

function nodeKey(n: StandNode): string {
  return `${n.x},${n.y},${n.z}`;
}

function stopPaintLoop(): void {
  if (paintHandle === undefined) {
    return;
  }
  system.clearRun(paintHandle);
  paintHandle = undefined;
}

function startPaintLoop(): void {
  if (paintHandle !== undefined) {
    return;
  }
  paintHandle = system.runInterval(() => {
    paintAll();
  }, PAINT_TICKS);
}

/**
 * 对一名玩家所在维度刷三层表粒子。
 * 可站且可达 → 只青绿；黄仅「可站减去可达」。
 */
function paintAroundPlayer(
  dim: Dimension,
  ox: number,
  oy: number,
  oz: number
): void {
  const dimId = dim.id;
  const reach = listReachabilityStands(dimId);
  const reachKeys = new Set(reach.map(nodeKey));
  // 黄层：查询侧已按视野箱裁切且全量返回，避免二次 inView / 数量截断
  const standOnly = listSharedStandablesNear(
    dimId,
    { x: ox, y: oy, z: oz },
    VIEW_H,
    VIEW_V,
    reachKeys
  );
  spawnAll(dim, PARTICLE_STAND, standOnly);
  spawnLayer(dim, PARTICLE_REACH, reach, ox, oy, oz);
  spawnLayer(
    dim,
    PARTICLE_BAN,
    unreachableCache.listActiveDests(dimId),
    ox,
    oy,
    oz
  );
}

function paintAll(): void {
  const players = world.getAllPlayers();
  if (players.length === 0) {
    return;
  }
  const seenDim = new Set<string>();
  for (const p of players) {
    if (!p.isValid) {
      continue;
    }
    const dim = p.dimension;
    if (seenDim.has(dim.id)) {
      continue;
    }
    seenDim.add(dim.id);
    const loc = p.location;
    paintAroundPlayer(dim, loc.x, loc.y, loc.z);
  }
}

/**
 * 按配置开关挂/卸刷粒子循环（无轮询）。
 * 使用场景：Config 初始化读计分板、设置面板变更 path_show_waypoints。
 */
export function setReachVizEnabled(enabled: boolean): void {
  if (enabled) {
    startPaintLoop();
  } else {
    stopPaintLoop();
  }
}
