// @ts-nocheck
/**
 * 耕地农作（Phase3）：不再刷 thlmt:farm。
 * 扫描只收集坐标 → 为该女仆选下一个可达点 → Path.follow（seek_marker）→
 * 由 Path onComplete(done) 推送到位后再对方块 acquire（不再靠轮询距离收尾）。
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
import { SEARCH_H, SEARCH_V } from "../path/constants";
import {
  buildRoiAround,
  ensureReachabilityField,
} from "../path/ReachabilityField";
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
/** 补种冷却：cellKey → expiryMs */
const plantCooldown = new Map();

/**
 * 耕地作物脚本农作（单女仆单目标 + Path.follow）。
 */
export class Farm {
  static maxLack = 2;
  static lackStep = 5;
  static minCount = 8;
  /** 单次扫描最多候选格数 */
  static maxCount = 25;
  /** 与调度扫描默认范围一致 */
  static claimRange = 15;

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

  /**
   * 卸 mode:farm NAT（农作改由 Seek/Path，不再用家族索敌）。
   */
  static pauseFarmNat(maid) {
    try {
      maid.triggerEvent("api:mode_quit_farm");
    } catch {
      /* ignore */
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

  static nearTask(maid, task) {
    const a = maid.location;
    const dx = Math.abs(a.x - (task.x + 0.5));
    const dz = Math.abs(a.z - (task.z + 0.5));
    const dy = Math.abs(a.y - task.y);
    return dx <= 2.5 && dz <= 2.5 && dy <= 5;
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
            if (!this.isPlantCooling(dimension.id, task)) {
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
   * 建可达场并选最近可达任务，启动 Path.follow。
   * @returns 是否已派出 follow
   */
  static assignNext(maid, tasks, range = Farm.claimRange) {
    if (!maid?.isValid || tasks.length === 0) {
      return false;
    }
    if (EntityMaid.Path.isFollowing(maid)) {
      return false;
    }

    const dim = maid.dimension;
    const loc = maid.location;
    const anchor = {
      x: Math.floor(loc.x),
      y: Math.floor(loc.y) - 1,
      z: Math.floor(loc.z),
    };
    const h = Math.max(range, SEARCH_H);
    const roi = buildRoiAround(anchor, h, SEARCH_V);
    const goals = tasks.map((t) => this.goalStandOfTask(t));
    try {
      ensureReachabilityField(dim, roi, goals);
    } catch (e) {
      Logger.warn(TAG, `ensureField: ${String(e)}`);
    }

    const ranked = tasks
      .filter((t) => this.isCellFreeFor(maid, t))
      .map((t) => ({ t, d2: this.dist2Maid(maid, t) }))
      .sort((a, b) => a.d2 - b.d2);

    for (const { t } of ranked) {
      const dest = { x: t.x, y: t.y, z: t.z };
      let ok = false;
      try {
        ok = EntityMaid.Path.canReach(maid, dest, {
          searchH: h,
          searchV: SEARCH_V,
        });
      } catch (e) {
        Logger.warn(TAG, `canReach: ${String(e)}`);
        continue;
      }
      if (!ok) {
        continue;
      }

      // 已在触及范围：直接 acquire，不再 follow
      if (this.nearTask(maid, t)) {
        this.claimCell(maid, t);
        try {
          this.acquireAt(maid, t);
        } finally {
          this.releaseCell(maid, t);
        }
        return true;
      }

      this.pauseFarmNat(maid);
      this.claimCell(maid, t);
      this.writeJob(maid, t);
      const expected = t;
      const result = EntityMaid.Path.follow(maid, dest, {
        searchH: h,
        searchV: SEARCH_V,
        onComplete: (info) => {
          Farm.onFollowComplete(maid, expected, info);
        },
      });
      if (!result.ok) {
        this.releaseCell(maid, t);
        this.writeJob(maid, undefined);
        continue;
      }
      return true;
    }
    return false;
  }

  /**
   * Path.follow 结束：done 则 acquire；fail/cancel 只释锁。
   * 使用场景：assignNext 注册的 onComplete；用 expected 防「换任务后旧 cancel」误清新 job。
   * @param {Entity} maid
   * @param {FarmTask} expected 启动 follow 时认领的任务
   * @param {PathFollowCompleteInfo} info
   */
  static onFollowComplete(maid, expected, info) {
    if (!maid?.isValid) {
      return;
    }
    if (EntityMaid.Work.get(maid) !== EntityMaid.Work.farm) {
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

    // done / fail：继续派下一格；cancel：不自动派（玩家取消 / 模式切换）
    if (info.reason === "cancel") {
      return;
    }
    if (EntityMaid.Pose.isSitting(maid)) {
      return;
    }
    if (EntityMaid.Path.isFollowing(maid)) {
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
    this.pauseFarmNat(maid);
    if (EntityMaid.Path.isFollowing(maid)) {
      return;
    }
    const curJob = this.readJob(maid);
    if (curJob) {
      // 有未完成任务：交给 onSchedulePulse / onFollowComplete 收尾
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
   * 调度脉冲：follow 中等待；仅在 near 时兜底 acquire。
   * 使用场景：MaidTarget.stepEvent（farm）。正常收尾由 onFollowComplete 推送。
   * 注意：!near 时不得清 job——Done 后 onComplete 可能尚未入队，且近战触及可宽于 nearTask。
   */
  static onSchedulePulse(maid) {
    if (!maid?.isValid) {
      return;
    }
    if (EntityMaid.Work.get(maid) !== EntityMaid.Work.farm) {
      return;
    }
    this.pauseFarmNat(maid);

    if (EntityMaid.Path.isFollowing(maid)) {
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
    }

    // 空闲补派（轻量：用 claimRange 扫描）
    if (!EntityMaid.Pose.isSitting(maid)) {
      const tasks = this.collectTasks(maid, Farm.claimRange);
      if (tasks.length > 0) {
        this.assignNext(maid, tasks, Farm.claimRange);
      } else {
        SpeedController.afterSearch(maid, 0, Farm.maxLack, Farm.minCount);
      }
    }
  }
}
