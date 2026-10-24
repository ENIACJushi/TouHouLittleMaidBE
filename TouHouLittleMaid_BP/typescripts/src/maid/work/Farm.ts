// @ts-nocheck
/**
 * 耕地农作（Phase3 / P7）：不再刷 thlmt:farm。
 * 扫描坐标 → 一次预占最近 N 格（无几何形状）→ 队列内逐格 Path.follow →
 * onComplete(done) 后再 acquire；下一项仍先 follow（禁 near 直收）。
 */
import {
  Entity,
  Dimension,
  system,
  BlockPermutation,
  BlockVolume,
} from "@minecraft/server";
import { Vector } from "../../libs/VectorMC";
import { Logger } from "../../controller/Logger";
import { EntityMaid } from "../EntityMaid";
import { FarmBlocks } from "../../../data/FarmBlocks/main";
import { StandableCache } from "../path/StandableCache";
import { standNodeFromFeet } from "../path/Path";
import { unreachableCache } from "../path/UnreachableCache";
import {
  activityCircleOf,
  isInsideActivityCircle,
} from "../path/field/activityCircle";
import { hasFieldUnknown, noteFieldUnknown } from "../path/field/fieldUnknown";
import {
  classifyFieldClaim,
  ensureStandHeight,
  reversiblePathResult,
} from "../path/field/StandField";
import { SpeedController } from "./SpeedController";

/**
 * @typedef {import("../path/types").PathFollowCompleteInfo} PathFollowCompleteInfo
 */

const TAG = "Farm";
/** 女仆当前农作任务（JSON：x,y,z,kind,crop?） */
const DP_FARM_JOB = "thlm:farm_job";
/** 补种失败冷却（毫秒），替代旧 thlmt:farm cooldown 实体 */
const PLANT_COOLDOWN_MS = 30_000;

/**
 * 单格农作任务（无标记实体）。
 * 使用场景：选点 / follow / 到位 acquire。
 */
type FarmTask = {
  x: number;
  y: number;
  z: number;
  /** harvest=收成熟作物；plant=空位种植 */
  kind: "harvest" | "plant";
  /** 补种时优先的作物 typeId */
  crop?: string;
};

/** 格占用：cellKey → maidId，避免双女仆同奔一格 */
const cellClaims = new Map();
/**
 * 已预占、尚未派出 follow 的后续任务。
 * 使用场景：P7 一次认领 N；key=maidId。
 */
const farmQueues = new Map();
/** 人已卸载、任务动态属性还没清掉的女仆 id */
const staleJobIds = new Set();
/** 补种冷却：cellKey → expiryMs */
const plantCooldown = new Map();

/**
 * 耕地作物脚本农作（预占队列 + 逐格 Path.follow）。
 */
export class Farm {
  static maxLack = 2;
  static lackStep = 5;
  static minCount = 8;
  /** 单次扫描最多候选格数 */
  static maxCount = 25;
  /** 与调度扫描默认范围一致 */
  static claimRange = 15;
  /**
   * 一次预占上限（按距女仆距离取最近 N，无形状）。
   * 使用场景：assignNext 入队。
   */
  static CLAIM_BATCH_N = 5;
  /**
   * 脉冲兜底「挨着作物」水平半宽（格）；脚位方盒，非 Arrive 球形触及。
   * 使用场景：nearTask / onSchedulePulse。
   */
  static NEAR_TASK_H = 2.5;
  /** 脉冲兜底竖直容差（格）；与 NEAR_TASK_H 配套。 */
  static NEAR_TASK_V = 5;

  static cellKey(dimId, x, y, z) {
    return `${dimId}|${x},${y},${z}`;
  }

  static taskKey(dimId, task) {
    return this.cellKey(dimId, task.x, task.y, task.z);
  }

  static readJob(maid) {
    try {
      const raw = maid.getDynamicProperty(DP_FARM_JOB);
      if (typeof raw !== "string" || raw.length < 3) {
        return undefined;
      }
      const j = JSON.parse(raw);
      if (
        typeof j?.x !== "number" ||
        typeof j?.y !== "number" ||
        typeof j?.z !== "number" ||
        (j.kind !== "harvest" && j.kind !== "plant")
      ) {
        return undefined;
      }
      return j;
    } catch {
      return undefined;
    }
  }

  static writeJob(maid, task) {
    try {
      if (!task) {
        maid.setDynamicProperty(DP_FARM_JOB, "");
        return;
      }
      maid.setDynamicProperty(DP_FARM_JOB, JSON.stringify(task));
    } catch (e) {
      Logger.warn(TAG, `writeJob: ${String(e)}`);
    }
  }

  static claimCell(maid, task) {
    cellClaims.set(this.taskKey(maid.dimension.id, task), maid.id);
  }

  static releaseCell(maid, task) {
    if (!task) {
      return;
    }
    const k = this.taskKey(maid.dimension.id, task);
    if (cellClaims.get(k) === maid.id) {
      cellClaims.delete(k);
    }
  }

  /**
   * 放开这名女仆占着的每一格，并丢掉预占队列。
   * 使用场景：切模式、走路结束时人已失效、失效通知、fail 整队释放。
   */
  static releaseOwner(ownerId) {
    for (const [key, id] of cellClaims) {
      if (id === ownerId) {
        cellClaims.delete(key);
      }
    }
    farmQueues.delete(ownerId);
  }

  /**
   * 只清预占队列里尚未派出的格（当前 farm_job 不动）。
   * 使用场景：follow fail 后丢掉剩余预占；单项校验失败时出队。
   */
  static releaseQueue(maid) {
    if (!maid) {
      return;
    }
    const q = farmQueues.get(maid.id);
    if (!q || q.length === 0) {
      farmQueues.delete(maid.id);
      return;
    }
    for (const t of q) {
      this.releaseCell(maid, t);
    }
    farmQueues.delete(maid.id);
  }

  /**
   * 人还在时清掉农作任务并放开格子。正在走的路会取消。
   * 使用场景：离开耕地模式；死亡、拍照、魂符收回时实体仍可读。
   */
  static abandon(maid) {
    if (!maid?.isValid) {
      try {
        if (maid) {
          this.markStale(maid.id);
        }
      } catch {
        // id 也读不到时，只能等失效通知按 id 放开
      }
      return;
    }
    this.releaseOwner(maid.id);
    this.writeJob(maid, undefined);
    try {
      EntityMaid.Path.cancel(maid);
    } catch (e) {
      Logger.warn(TAG, `abandon cancel: ${String(e)}`);
    }
  }

  /**
   * 人已经不在世界里：先放开格子，等她再被加载时清任务。
   * 使用场景：thlmm:t 超时，或走路回调时实体已失效。
   */
  static markStale(ownerId) {
    this.releaseOwner(ownerId);
    staleJobIds.add(ownerId);
  }

  /**
   * 卸载后又加载：清掉上次没写掉的任务。
   * 使用场景：thlmm:t 到来时，先于本拍收割。
   */
  static settle(maid) {
    if (!maid?.isValid || !staleJobIds.has(maid.id)) {
      return;
    }
    staleJobIds.delete(maid.id);
    this.releaseOwner(maid.id);
    this.writeJob(maid, undefined);
    try {
      EntityMaid.Path.cancel(maid);
    } catch (e) {
      Logger.warn(TAG, `settle cancel: ${String(e)}`);
    }
  }

  static isCellFreeFor(maid, task) {
    const owner = cellClaims.get(this.taskKey(maid.dimension.id, task));
    return owner === undefined || owner === maid.id;
  }

  static isPlantCooling(dimId, task) {
    const k = this.taskKey(dimId, task);
    const exp = plantCooldown.get(k);
    if (exp === undefined) {
      return false;
    }
    if (Date.now() > exp) {
      plantCooldown.delete(k);
      return false;
    }
    return true;
  }

  static markPlantCooldown(dimId, task) {
    plantCooldown.set(this.taskKey(dimId, task), Date.now() + PLANT_COOLDOWN_MS);
  }

  /**
   * 背包里现有物品的类型。不扣数量。
   * 使用场景：空耕地选点前，对照这块土能种的种子。
   */
  static backpackTypeIds(maid) {
    const have = new Set();
    const container = EntityMaid.Backpack.getContainer(maid);
    if (container === undefined) {
      return have;
    }
    for (let i = 0; i < container.size; i++) {
      const item = container.getItem(i);
      if (item !== undefined && item.amount > 0) {
        have.add(item.typeId);
      }
    }
    return have;
  }

  /**
   * 这块土对应的种子，背包里是否至少有一种。
   * 使用场景：没有种子的空耕地不当目标。收割不走这里。
   */
  static landHasSeed(have, landTypeId) {
    const seeds = FarmBlocks.getInstance().getLand(landTypeId);
    if (seeds === undefined) {
      return false;
    }
    for (const seed of seeds) {
      if (have.has(seed)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 给定种子名称，种植一个作物。
   */
  static plantSeed(maid, location, seedName, landName) {
    if (EntityMaid.Backpack.removeItem_type(maid, seedName, 1) === true) {
      let seedInfos = FarmBlocks.getInstance().getSeed(seedName);
      if (seedInfos !== undefined) {
        for (let seedInfo of seedInfos) {
          if (seedInfo.land.includes(landName)) {
            maid.dimension.setBlockPermutation(
              location,
              BlockPermutation.resolve(seedInfo.block, seedInfo.state)
            );
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * 到位后对目标格种植/收获（无 thlmt:farm 实体）。
   * 使用场景：follow Done / 已在触及范围。
   */
  static acquireAt(maid, task) {
    const dimension = maid.dimension;
    const location = new Vector(task.x, task.y, task.z);
    const selfBlock = dimension.getBlock(location);
    const landBlock = dimension.getBlock(
      new Vector(location.x, location.y - 1, location.z)
    );

    if (task.kind === "plant") {
      if (selfBlock !== undefined && selfBlock.typeId !== "minecraft:air") {
        return;
      }
      let type = task.crop;
      let replant = type !== undefined;
      if (type === undefined) {
        let names = {};
        for (let delta of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ]) {
          let block = dimension.getBlock(
            new Vector(location.x + delta[0], location.y, location.z + delta[1])
          );
          if (block !== undefined) {
            if (names[block.typeId] === undefined) names[block.typeId] = 1;
            else names[block.typeId]++;
          }
        }
        let max = 0;
        for (let key in names) {
          if (names[key] > max) {
            type = key;
            max = names[key];
          }
        }
      }

      if (type !== undefined) {
        let corpInfo = FarmBlocks.getInstance().getCorp(type);
        if (corpInfo !== undefined && landBlock) {
          if (this.plantSeed(maid, location, corpInfo.seed, landBlock.typeId)) {
            return;
          }
        }
      }

      if (replant) {
        this.markPlantCooldown(dimension.id, task);
      }

      if (landBlock !== undefined && landBlock.typeId !== "minecraft:air") {
        let seedList = FarmBlocks.getInstance().getLand(landBlock.typeId);
        if (seedList !== undefined) {
          for (let seed of seedList) {
            if (this.plantSeed(maid, location, seed, landBlock.typeId)) {
              return;
            }
          }
        }
      }
      return;
    }

    // harvest
    if (selfBlock === undefined) {
      return;
    }
    let cropName = selfBlock.typeId;
    let info = FarmBlocks.getInstance().getCorp(cropName);
    if (
      info !== undefined &&
      selfBlock.permutation.matches(cropName, info.state)
    ) {
      if (info.keep === undefined) {
        dimension.runCommand(
          `setblock ${location.x} ${location.y} ${location.z} air destroy`
        );
        // 同格立刻尝试补种（已在触及范围，无需再 follow）
        this.acquireAt(maid, {
          x: task.x,
          y: task.y,
          z: task.z,
          kind: "plant",
          crop: cropName,
        });
      } else {
        maid.runCommand(`loot spawn ${location.x} ${location.y} ${location.z} loot "${info.keep.loot}"`);
        dimension.setBlockPermutation(
          location,
          BlockPermutation.resolve(info.keep.block, info.keep.state)
        );
      }
    }
  }

  /**
   * 调度脉冲兜底：人是否已挨着作物格（脚位水平方盒，**不是** Arrive 头点球形触及）。
   * 使用场景：onComplete 丢失时补 acquire；与 `ARRIVE_GOAL_R` / Seek melee 无关，勿混用。
   */
  static nearTask(maid, task) {
    const a = maid.location;
    const dx = Math.abs(a.x - (task.x + 0.5));
    const dz = Math.abs(a.z - (task.z + 0.5));
    const dy = Math.abs(a.y - task.y);
    return dx <= Farm.NEAR_TASK_H && dz <= Farm.NEAR_TASK_H && dy <= Farm.NEAR_TASK_V;
  }

  static dist2Maid(maid, task) {
    const dx = maid.location.x - (task.x + 0.5);
    const dz = maid.location.z - (task.z + 0.5);
    return dx * dx + dz * dz;
  }

  /**
   * 支撑格（作物格下方），供可达场种子。
   */
  static goalStandOfTask(task) {
    return { x: task.x, y: task.y - 1, z: task.z };
  }

  /**
   * 在范围内扫描候选任务（不 spawn 实体）。
   * @returns {FarmTask[]}
   */
  static collectTasks(maid, range) {
    const dimension = maid.dimension;
    const location = maid.location;
    const areaLength = range * 2 + 2;
    const searchMatrix = new Array(areaLength);
    for (let i = 0; i < areaLength; i++) {
      searchMatrix[i] = new Array(areaLength).fill(false);
    }
    const tasks = [];
    let count = 0;
    const seedsOnHand = this.backpackTypeIds(maid);

    for (let ix = 0; ix < range; ix = ix > 0 ? -ix : 2 - ix) {
      let blockVolume = new BlockVolume(
        new Vector(location.x + ix, location.y - 2, location.z - range),
        new Vector(location.x + ix + 1, location.y + 2, location.z + range)
      );
      let lands = dimension.getBlocks(
        blockVolume,
        {
          includePermutations: FarmBlocks.getInstance().getCorpPermutations(),
          includeTypes: FarmBlocks.getInstance().getLands(),
        },
        true
      );
      for (let pos of lands.getBlockLocationIterator()) {
        if (count >= Farm.maxCount) {
          break;
        }
        let m_x = Math.floor(pos.x - location.x + range) + 1;
        let m_z = Math.floor(pos.z - location.z + range) + 1;
        if (
          m_x < 0 ||
          m_z < 0 ||
          m_x >= areaLength ||
          m_z >= areaLength ||
          searchMatrix[m_x][m_z] === true
        ) {
          continue;
        }

        let block = dimension.getBlock(pos);
        if (FarmBlocks.getInstance().getLand(block.typeId) !== undefined) {
          let blockLocation = new Vector(pos.x, pos.y + 1, pos.z);
          let above = dimension.getBlock(blockLocation);
          if (above === undefined || above.typeId === "minecraft:air") {
            const task = {
              x: Math.floor(blockLocation.x),
              y: Math.floor(blockLocation.y),
              z: Math.floor(blockLocation.z),
              kind: "plant",
            };
            // 没有能种在这块土上的种子：不占候选名额，也不出发
            if (
              !this.isPlantCooling(dimension.id, task) &&
              this.landHasSeed(seedsOnHand, block.typeId)
            ) {
              tasks.push(task);
              count++;
            }
            searchMatrix[m_x][m_z] = true;
            continue;
          }
          block = above;
        }

        let corpInfo = FarmBlocks.getInstance().getCorp(block.typeId);
        if (corpInfo !== undefined) {
          let mature = true;
          for (let key in corpInfo.state) {
            if (block.permutation.getState(key) !== corpInfo.state[key]) {
              mature = false;
              break;
            }
          }
          if (mature) {
            tasks.push({
              x: Math.floor(block.location.x),
              y: Math.floor(block.location.y),
              z: Math.floor(block.location.z),
              kind: "harvest",
            });
            count++;
          }
          searchMatrix[m_x][m_z] = true;
        }
      }
      if (count >= Farm.maxCount) {
        break;
      }
    }
    return tasks;
  }

  /**
   * 补种任务在出发前再对一次背包。扫描和选点之间种子可能被拿走。
   * 使用场景：assignNext。收割任务直接通过。
   */
  static plantTaskHasSeed(maid, task, have) {
    if (task.kind !== "plant") {
      return true;
    }
    const land = maid.dimension.getBlock({
      x: task.x,
      y: task.y - 1,
      z: task.z,
    });
    if (land === undefined) {
      return false;
    }
    return this.landHasSeed(have, land.typeId);
  }

  /**
   * 预占队列里的格是否仍值得去做。
   * 使用场景：出队续 follow 前校验；作物被收走 / 无种子则释放该项。
   */
  static taskStillValid(maid, task, circle, seedsOnHand) {
    const dim = maid.dimension;
    if (!isInsideActivityCircle(circle, dim.id, task.x, task.z)) {
      return false;
    }
    const owner = cellClaims.get(this.taskKey(dim.id, task));
    if (owner !== undefined && owner !== maid.id) {
      return false;
    }
    if (task.kind === "plant") {
      if (this.isPlantCooling(dim.id, task)) {
        return false;
      }
      if (!this.plantTaskHasSeed(maid, task, seedsOnHand)) {
        return false;
      }
      const above = dim.getBlock({ x: task.x, y: task.y, z: task.z });
      return above !== undefined && above.typeId === "minecraft:air";
    }
    const block = dim.getBlock({ x: task.x, y: task.y, z: task.z });
    if (block === undefined) {
      return false;
    }
    const corpInfo = FarmBlocks.getInstance().getCorp(block.typeId);
    if (corpInfo === undefined) {
      return false;
    }
    for (const key in corpInfo.state) {
      if (block.permutation.getState(key) !== corpInfo.state[key]) {
        return false;
      }
    }
    return true;
  }

  /**
   * 对已认领的一格规划并 Path.follow（远近一律走 follow）。
   * 使用场景：assignNext 队首；队列续派。
   * @returns {true|false|"unready"|"unknown"}
   */
  static tryFollowTask(maid, task) {
    const dim = maid.dimension;
    const probe = new StandableCache(dim);
    const start = standNodeFromFeet(probe, maid.location);
    if (!start) {
      return false;
    }
    ensureStandHeight(dim, start.x, start.y, start.z);
    const goal = this.goalStandOfTask(task);
    ensureStandHeight(dim, goal.x, goal.y, goal.z);
    const fieldClaim = classifyFieldClaim(dim, start, goal);
    if (fieldClaim === "unready") {
      return "unready";
    }
    if (fieldClaim !== "same") {
      return false;
    }
    if (unreachableCache.has(dim.id, goal, maid.id)) {
      return false;
    }
    EntityMaid.Path.suppressHomeReturn(maid);
    const planned = reversiblePathResult(dim, start, goal);
    if (!planned.ok) {
      EntityMaid.Path.allowHomeReturn(maid);
      if (planned.reason === "field_unknown") {
        return "unknown";
      }
      return false;
    }
    this.writeJob(maid, task);
    const expected = task;
    const started = EntityMaid.Path.followResult(maid, planned, {
      onComplete: (info) => {
        Farm.onFollowComplete(maid, expected, info);
      },
    });
    if (!started) {
      EntityMaid.Path.allowHomeReturn(maid);
      this.writeJob(maid, undefined);
      return false;
    }
    return true;
  }

  /**
   * 从预占队列取出下一项并 follow；无效项释放后继续。
   * 使用场景：onFollowComplete(done) / pulse 兜底收完后。
   * @returns 是否已派出 follow
   */
  static tryStartNextFromQueue(maid) {
    if (!maid?.isValid || EntityMaid.Path.isFollowing(maid)) {
      return false;
    }
    if (EntityMaid.Pose.isSitting(maid)) {
      this.releaseQueue(maid);
      return false;
    }
    const circleState = activityCircleOf(maid);
    if (circleState.kind !== "circle") {
      this.releaseQueue(maid);
      return false;
    }
    const seedsOnHand = this.backpackTypeIds(maid);
    while (true) {
      const q = farmQueues.get(maid.id);
      if (!q || q.length === 0) {
        farmQueues.delete(maid.id);
        return false;
      }
      const next = q.shift();
      if (q.length === 0) {
        farmQueues.delete(maid.id);
      } else {
        farmQueues.set(maid.id, q);
      }
      if (!this.taskStillValid(maid, next, circleState.circle, seedsOnHand)) {
        this.releaseCell(maid, next);
        continue;
      }
      if (cellClaims.get(this.taskKey(maid.dimension.id, next)) !== maid.id) {
        this.claimCell(maid, next);
      }
      const started = this.tryFollowTask(maid, next);
      if (started === true) {
        return true;
      }
      this.releaseCell(maid, next);
      if (started === "unready" || started === "unknown") {
        this.releaseQueue(maid);
        if (started === "unknown") {
          noteFieldUnknown(maid);
        }
        return false;
      }
    }
  }

  /**
   * 空闲时：按距离取最近至多 N 格预占，队首 follow，其余进队列。
   * 圈外可途经不可认领；场 unready 本拍不改去更远场；每格必 follow。
   * @returns 是否已派出 follow
   */
  static assignNext(maid, tasks, _range = Farm.claimRange) {
    if (!maid?.isValid || tasks.length === 0) {
      return false;
    }
    if (EntityMaid.Path.isFollowing(maid)) {
      return false;
    }
    if (hasFieldUnknown(maid)) {
      return false;
    }
    const circleState = activityCircleOf(maid);
    if (circleState.kind !== "circle") {
      return false;
    }
    const circle = circleState.circle;

    const dim = maid.dimension;
    const probe = new StandableCache(dim);
    const start = standNodeFromFeet(probe, maid.location);
    if (!start) {
      return false;
    }
    ensureStandHeight(dim, start.x, start.y, start.z);

    const seedsOnHand = this.backpackTypeIds(maid);
    // 近者优先；同距收割先于补种
    const ranked = tasks
      .filter(
        (t) =>
          this.isCellFreeFor(maid, t) &&
          this.plantTaskHasSeed(maid, t, seedsOnHand)
      )
      .map((t) => ({ t, d2: this.dist2Maid(maid, t) }))
      .sort((a, b) => {
        if (a.d2 !== b.d2) {
          return a.d2 - b.d2;
        }
        if (a.t.kind === b.t.kind) {
          return 0;
        }
        return a.t.kind === "harvest" ? -1 : 1;
      });

    /** @type {FarmTask[]} */
    const batch = [];
    for (const { t } of ranked) {
      if (batch.length >= Farm.CLAIM_BATCH_N) {
        break;
      }
      if (!isInsideActivityCircle(circle, dim.id, t.x, t.z)) {
        continue;
      }
      const goal = this.goalStandOfTask(t);
      ensureStandHeight(dim, goal.x, goal.y, goal.z);
      const fieldClaim = classifyFieldClaim(dim, start, goal);
      if (fieldClaim === "unready") {
        if (batch.length === 0) {
          return false;
        }
        break;
      }
      if (fieldClaim !== "same") {
        continue;
      }
      if (unreachableCache.has(dim.id, goal, maid.id)) {
        continue;
      }
      batch.push(t);
    }
    if (batch.length === 0) {
      return false;
    }

    this.releaseQueue(maid);
    for (const t of batch) {
      this.claimCell(maid, t);
    }
    /** 待派出列表：shift 当前项，剩余写入 farmQueues */
    const pending = batch.slice();
    while (pending.length > 0) {
      const head = pending.shift();
      if (pending.length > 0) {
        farmQueues.set(maid.id, pending.slice());
      } else {
        farmQueues.delete(maid.id);
      }
      const started = this.tryFollowTask(maid, head);
      if (started === true) {
        return true;
      }
      this.releaseCell(maid, head);
      this.writeJob(maid, undefined);
      if (started === "unready" || started === "unknown") {
        this.releaseQueue(maid);
        if (started === "unknown") {
          noteFieldUnknown(maid);
        }
        return false;
      }
    }
    return false;
  }

  /**
   * Path.follow 结束：done 则 acquire；再对队列下一项 follow（必经 follow）。
   * fail 释放剩余预占；cancel 不自动续派。
   * @param {Entity} maid
   * @param {FarmTask} expected 启动 follow 时认领的任务
   * @param {PathFollowCompleteInfo} info
   */
  static onFollowComplete(maid, expected, info) {
    if (!maid?.isValid) {
      try {
        if (maid) {
          this.markStale(maid.id);
        }
      } catch {
        // 实体 id 不可读
      }
      return;
    }
    if (EntityMaid.Work.get(maid) !== EntityMaid.Work.farm) {
      this.releaseCell(maid, expected);
      this.releaseOwner(maid.id);
      const left = this.readJob(maid);
      if (
        left &&
        left.x === expected.x &&
        left.y === expected.y &&
        left.z === expected.z &&
        left.kind === expected.kind
      ) {
        this.writeJob(maid, undefined);
      }
      return;
    }
    const job = this.readJob(maid);
    if (
      !job ||
      job.x !== expected.x ||
      job.y !== expected.y ||
      job.z !== expected.z ||
      job.kind !== expected.kind
    ) {
      // 已被新任务覆盖或已清掉：忽略（常见于 start 替换旧会话的 cancel）
      return;
    }

    if (info.reason === "done") {
      try {
        this.acquireAt(maid, job);
      } catch (e) {
        Logger.warn(TAG, `acquireAt(onComplete): ${String(e)}`);
      }
    } else {
      Logger.info(
        TAG,
        `follow ${info.reason} detail=${info.detail} job=${job.x},${job.y},${job.z}`
      );
    }

    this.releaseCell(maid, job);
    this.writeJob(maid, undefined);

    if (info.reason === "cancel") {
      this.releaseQueue(maid);
      return;
    }
    if (info.reason === "fail") {
      this.releaseQueue(maid);
    }
    if (EntityMaid.Pose.isSitting(maid)) {
      this.releaseQueue(maid);
      return;
    }
    if (EntityMaid.Path.isFollowing(maid)) {
      return;
    }
    // done：先耗预占队列；fail 已清队列后重扫
    if (info.reason === "done" && this.tryStartNextFromQueue(maid)) {
      return;
    }
    const tasks = this.collectTasks(maid, Farm.claimRange);
    if (tasks.length > 0) {
      this.assignNext(maid, tasks, Farm.claimRange);
    } else {
      SpeedController.afterSearch(maid, 0, Farm.maxLack, Farm.minCount);
    }
  }

  /**
   * 寻找并派出下一个农作点（扫描坐标，不刷标记实体）。
   */
  static search(maid, _range = 6, force = false) {
    if (!maid?.isValid) {
      return;
    }
    if (EntityMaid.Path.isFollowing(maid)) {
      return;
    }
    const curJob = this.readJob(maid);
    if (curJob || (farmQueues.get(maid.id)?.length ?? 0) > 0) {
      // 有当前任务或预占队列：交给 onSchedulePulse / onFollowComplete 收尾
      return;
    }

    let range = _range;
    let temp = SpeedController.beforeSearch(maid, this.maxLack, this.lackStep);
    if (!force && !temp.run) {
      return;
    }
    if (temp.lackmode) {
      range = range + 10;
    }

    const runRange = range;
    system.runJob(
      (function* () {
        if (!maid.isValid) {
          return;
        }
        const tasks = Farm.collectTasks(maid, runRange);
        yield;
        if (!maid.isValid) {
          return;
        }
        SpeedController.afterSearch(
          maid,
          tasks.length,
          Farm.maxLack,
          Farm.minCount
        );
        Farm.assignNext(maid, tasks, runRange);
      })()
    );
  }

  /**
   * 调度脉冲：follow 中、以及走完通知还没跑时，都不要收割。
   * 使用场景：MaidTarget.stepEvent（farm）。正常收尾由 onFollowComplete 推送。
   * 通知已经丢了、人又在格子旁边时，才由这里补一次 acquire。
   * 注意：!near 时不得清 job；nearTask 是旁圈兜底，与脚本/近战球形触及无关。
   */
  static onSchedulePulse(maid) {
    if (!maid?.isValid) {
      return;
    }
    if (EntityMaid.Work.get(maid) !== EntityMaid.Work.farm) {
      return;
    }

    if (EntityMaid.Path.isFollowing(maid)) {
      return;
    }
    // 跟随已结束，走完通知下一帧才收。这一拍不要抢收，也不要改派。
    if (EntityMaid.Path.hasPendingComplete(maid)) {
      return;
    }

    const job = this.readJob(maid);
    if (job) {
      // 只兜底「已靠近」：未靠近交给 onFollowComplete，避免抢清 job 漏收割
      if (!this.nearTask(maid, job)) {
        return;
      }
      try {
        this.acquireAt(maid, job);
      } catch (e) {
        Logger.warn(TAG, `acquireAt(pulse): ${String(e)}`);
      }
      this.releaseCell(maid, job);
      this.writeJob(maid, undefined);
      // 通知丢失兜底后：队列下一项仍走 follow，不 near 直收
      if (this.tryStartNextFromQueue(maid)) {
        return;
      }
    }

    // 空闲补派（轻量：用 claimRange 扫描）
    if (!EntityMaid.Pose.isSitting(maid)) {
      if (this.tryStartNextFromQueue(maid)) {
        return;
      }
      const tasks = this.collectTasks(maid, Farm.claimRange);
      if (tasks.length > 0) {
        this.assignNext(maid, tasks, Farm.claimRange);
      } else {
        SpeedController.afterSearch(maid, 0, Farm.maxLack, Farm.minCount);
      }
    }
  }
}
