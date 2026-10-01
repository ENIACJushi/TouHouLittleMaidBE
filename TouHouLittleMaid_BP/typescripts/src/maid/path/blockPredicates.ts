/**
 * 方块支撑 / 穿过 / 危险谓词（Phase0a §6.2 锁定公式）。
 * 使用场景：StandableCache 与探针对照；禁止再并存多套启发式。
 *
 * 后置 TODO：栅栏顶部可站，面积随连接状态变化——首版整格 support=false。
 */
import { Block } from "@minecraft/server";
import { BlockFlags } from "./types";

/** 谓词求值上下文（仅水是否当危险需要运行时配置） */
export type PredicateContext = {
  /** 水当 hazard；默认 true */
  waterAsHazard?: boolean;
};

/**
 * 从 Block 抽出谓词所需字段（便于单测用字面量代替真实 Block）。
 * 使用场景：StandableCache 读世界；单元测试可喂 FakeBlockView。
 */
export type BlockView = {
  typeId: string;
  isAir: boolean;
  isSolid: boolean;
  isLiquid: boolean;
  /** permutation 状态；活板门等特例需要 */
  states?: Record<string, boolean | number | string>;
  tags?: string[];
};

/**
 * 将运行时 Block 转成 BlockView。
 * 使用场景：缓存填充时统一入口。
 */
export function toBlockView(block: Block): BlockView {
  let states: Record<string, boolean | number | string> | undefined;
  let tags: string[] | undefined;
  try {
    states = block.permutation?.getAllStates?.() as
      | Record<string, boolean | number | string>
      | undefined;
  } catch {
    states = undefined;
  }
  try {
    tags = block.permutation?.getTags?.();
  } catch {
    tags = undefined;
  }
  return {
    typeId: block.typeId,
    isAir: block.isAir,
    isSolid: block.isSolid,
    isLiquid: block.isLiquid,
    states,
    tags,
  };
}

function shortId(typeId: string): string {
  const i = typeId.indexOf(":");
  return i >= 0 ? typeId.slice(i + 1) : typeId;
}

function includesAny(id: string, parts: string[]): boolean {
  for (const p of parts) {
    if (id.includes(p)) {
      return true;
    }
  }
  return false;
}

/**
 * 栅栏 / 方块墙（非整格顶面；首版身不可穿、不可支撑）。
 * 排除 wall_sign / wall_banner 等贴墙装饰。
 */
function isFenceOrWall(id: string): boolean {
  if (id.includes("fence")) {
    return true;
  }
  if (id.includes("sign") || id.includes("banner") || id.includes("torch")) {
    return false;
  }
  return id.includes("_wall") || id.endsWith("wall");
}

/** 植物薄片：身可过 */
function isPlantThin(id: string): boolean {
  return (
    includesAny(id, [
      "short_grass",
      "tall_grass",
      "fern",
      "deadbush",
      "dead_bush",
      "dandelion",
      "poppy",
      "orchid",
      "allium",
      "azure_bluet",
      "tulip",
      "oxeye",
      "cornflower",
      "lily_of_the_valley",
      "wither_rose",
      "torchflower",
      "pink_petals",
      "spore_blossom",
      "flower",
      "wheat",
      "carrots",
      "potatoes",
      "beetroot",
      "sweet_berry",
      "nether_wart",
    ]) || id.endsWith("_sapling")
  );
}

/** 装饰薄片：身可过 */
function isDecorThin(id: string): boolean {
  return (
    includesAny(id, ["torch", "_sign", "lever", "tripwire", "rail", "redstone_wire", "button"]) ||
    id.includes("pressure_plate") ||
    id.includes("carpet")
  );
}

/**
 * 是否 NavMismatch（局部站立面 / 引擎易误判）。
 * 使用场景：首版 Walk 禁或特殊边；栅栏顶几何后置，此处不标 mismatch（整格已当不可支撑）。
 */
export function isNavMismatch(view: BlockView): boolean {
  const id = shortId(view.typeId);
  return (
    id.includes("trapdoor") ||
    id.includes("stairs") ||
    id.includes("ladder") ||
    id.includes("scaffolding")
  );
}

/**
 * 关闭且底装的活板门 → 薄支撑（≈地毯）。
 * 使用场景：isSupport 特例；开活板门 / 顶装不归此。
 */
export function isClosedBottomTrapdoor(view: BlockView): boolean {
  const id = shortId(view.typeId);
  if (!id.includes("trapdoor")) {
    return false;
  }
  const st = view.states;
  if (!st) {
    return false;
  }
  const open = st["open_bit"] === true || st["open_bit"] === 1;
  const upside = st["upside_down_bit"] === true || st["upside_down_bit"] === 1;
  return !open && !upside;
}

/**
 * isHazard：液体 ∪ lava/fire；（可选）水。
 * 使用场景：不可站节点；农作默认 waterAsHazard。
 */
export function isHazard(view: BlockView, ctx?: PredicateContext): boolean {
  if (view.isLiquid) {
    const id = shortId(view.typeId);
    if (id === "water" || id.includes("water")) {
      return ctx?.waterAsHazard !== false;
    }
    return true;
  }
  const id = shortId(view.typeId);
  return id.includes("lava") || id.includes("fire") || id === "magma";
}

/**
 * isPassable：身位可占。
 * 不可穿：solid / glass / leaves / fence / wall；活板门/楼梯不靠本式一刀切（仍给保守默认）。
 */
export function isPassable(view: BlockView): boolean {
  if (view.isAir) {
    return true;
  }
  const id = shortId(view.typeId);

  // 明确不可穿
  if (view.isSolid) {
    return false;
  }
  if (id.includes("glass") || id.includes("leaves")) {
    return false;
  }
  if (isFenceOrWall(id)) {
    return false;
  }

  // NavMismatch：保守 — 关底活板门身可过（薄板），开/楼梯交给特殊边，身位默认不可当普通净空
  if (id.includes("stairs") || id.includes("ladder") || id.includes("scaffolding")) {
    return false;
  }
  if (id.includes("trapdoor")) {
    // 关底：薄地板，身在其上格；本格（活板门格）通常脚不占同一格。
    // 若脚/头查询落到活板门格：关底可视为可过薄片，开则侧板挡一部分——首版一律 false 防锁死。
    return false;
  }

  if (isPlantThin(id) || isDecorThin(id)) {
    return true;
  }

  // 液体身可「进」但站立另判；净空采样时液体当不可过更安全
  if (view.isLiquid) {
    return false;
  }

  // 默认：非 solid 且未列入黑名单 → 可过（火把等漏网）
  // 但玻璃/叶已否；余下如 sugar_cane 等：农作相关可后扩白名单
  return !view.isSolid;
}

/**
 * isSupport：顶面可当整格站立面。
 * 否：air/liquid/fence·wall（整格；顶部可站 TODO）/压力板/开活板门。
 */
export function isSupport(view: BlockView): boolean {
  if (view.isAir || view.isLiquid) {
    return false;
  }
  const id = shortId(view.typeId);

  if (id.includes("pressure_plate") || id.includes("button")) {
    return false;
  }
  if (isPlantThin(id)) {
    return false;
  }
  if (id.includes("torch") || id.includes("_sign") || id.includes("lever")) {
    return false;
  }

  // 栅栏 / 墙：首版整格不支撑（顶部可站后置 TODO）
  if (isFenceOrWall(id)) {
    return false;
  }

  // 关底活板门 ≈ 地毯薄支撑
  if (isClosedBottomTrapdoor(view)) {
    return true;
  }
  // 其它活板门 / 楼梯 / 梯子：非整格支撑
  if (
    id.includes("trapdoor") ||
    id.includes("stairs") ||
    id.includes("ladder") ||
    id.includes("scaffolding")
  ) {
    return false;
  }

  if (id.includes("carpet")) {
    return true;
  }
  if (id.includes("glass")) {
    return true;
  }
  // 树叶：G-Player 主干按不可靠支撑处理（isSolid=false）；不当地板
  if (id.includes("leaves")) {
    return false;
  }

  if (view.isSolid) {
    return true;
  }

  return false;
}

/**
 * 一次算出缓存用 BlockFlags。
 * 使用场景：StandableCache.getFlags。
 */
export function evalBlockFlags(view: BlockView, ctx?: PredicateContext): BlockFlags {
  return {
    passable: isPassable(view),
    support: isSupport(view),
    hazard: isHazard(view, ctx),
    navMismatch: isNavMismatch(view),
  };
}

/**
 * 可站立节点：below 支撑 ∧ foot/head 可穿过 ∧ below/foot 非 hazard。
 * 使用场景：A* 节点生成；footY = below.y + 1。
 */
export function isStandableAt(
  below: BlockFlags,
  foot: BlockFlags,
  head: BlockFlags
): boolean {
  if (!below.support) {
    return false;
  }
  if (below.hazard || foot.hazard || head.hazard) {
    return false;
  }
  if (!foot.passable || !head.passable) {
    return false;
  }
  // 关底活板门：support=true 且 navMismatch=true → 允许（≈地毯）
  // 开活板门/楼梯等：support=false，已在上方否决
  return true;
}
