/**
 * 甘蔗、瓜、可可共用的认领和出发。
 * 使用场景：扫描只给出作物格；人走到旁边的落脚点，抵达后再对作物格动手。
 * 耕地仍走 Farm 自己的那套，不经过这里。
 */
import { Entity, system } from "@minecraft/server";
import { Logger } from "../../controller/Logger";
import { EntityMaid } from "../EntityMaid";
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
import { PathFollowCompleteInfo, StandNode } from "../path/types";
import { SpeedController } from "./SpeedController";

/**
 * 一格作物。direction 只给可可补种记住朝向。
 * 使用场景：扫描结果、身上的任务、格子占用。
 */
export type CropTask = {
  x: number;
  y: number;
  z: number;
  direction?: number;
};

/**
 * 一种工作怎么扫、怎么收，以及它自己的慢扫描参数。
 * 使用场景：createCropRoute。
 */
export type CropRouteOptions = {
  /** 日志前缀 */
  tag: string;
  /** EntityMaid.Work 里的模式编号，结束时对不上就不收 */
  workId: number;
  /** 身上当前任务的动态属性名 */
  jobKey: string;
  maxLack: number;
  lackStep: number;
  minCount: number;
  claimRange: number;
  collect(maid: Entity, range: number): CropTask[];
  acquireAt(maid: Entity, task: CropTask): void;
};

/** 与 Farm.nearTask 相同：人已经在作物旁边就当场动手 */
const NEAR_H = 2.5;
const NEAR_V = 5;

const BESIDE: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * 作物格四邻的落脚点。
 * 先看和作物同一高度的脚位，再看下一格：甘蔗砍的是土上方第二格，人要站在土上。
 * 使用场景：出发前把作物格换成可认领的落脚点。
 */
function standsBeside(cache: StandableCache, task: CropTask): StandNode[] {
  const found = new Map<string, StandNode>();
  for (const feetY of [task.y, task.y - 1]) {
    for (const [dx, dz] of BESIDE) {
      const node = standNodeFromFeet(cache, {
        x: task.x + dx + 0.5,
        y: feetY,
        z: task.z + dz + 0.5,
      });
      if (!node) {
        continue;
      }
      if (node.x === task.x && node.y === task.y && node.z === task.z) {
        continue;
      }
      found.set(`${node.x},${node.y},${node.z}`, node);
    }
  }
  return [...found.values()];
}

function dist2(maid: Entity, x: number, z: number): number {
  const dx = maid.location.x - (x + 0.5);
  const dz = maid.location.z - (z + 0.5);
  return dx * dx + dz * dz;
}

function nearCrop(maid: Entity, task: CropTask): boolean {
  const a = maid.location;
  return (
    Math.abs(a.x - (task.x + 0.5)) <= NEAR_H &&
    Math.abs(a.z - (task.z + 0.5)) <= NEAR_H &&
    Math.abs(a.y - task.y) <= NEAR_V
  );
}

/**
 * 做出一种「扫作物 → 认领 → 沿可逆邻居走过去 → 抵达后动手」的路由。
 * 使用场景：SugarCane / Melon / Cocoa 各持有一份，格子占用互不相通。
 */
export function createCropRoute(options: CropRouteOptions) {
  /** 作物格 → 女仆 id */
  const cellClaims = new Map<string, string>();

  function cellKey(dimId: string, task: CropTask): string {
    return `${dimId}|${task.x},${task.y},${task.z}`;
  }

  function readJob(maid: Entity): CropTask | undefined {
    try {
      const raw = maid.getDynamicProperty(options.jobKey);
      if (typeof raw !== "string" || raw.length < 3) {
        return undefined;
      }
      const job = JSON.parse(raw) as CropTask;
      if (
        typeof job?.x !== "number" ||
        typeof job?.y !== "number" ||
        typeof job?.z !== "number"
      ) {
        return undefined;
      }
      return job;
    } catch {
      return undefined;
    }
  }

  function writeJob(maid: Entity, task: CropTask | undefined): void {
    try {
      maid.setDynamicProperty(
        options.jobKey,
        task ? JSON.stringify(task) : ""
      );
    } catch (e) {
      Logger.warn(options.tag, `writeJob: ${String(e)}`);
    }
  }

  function claimCell(maid: Entity, task: CropTask): void {
    cellClaims.set(cellKey(maid.dimension.id, task), maid.id);
  }

  function releaseCell(maid: Entity, task: CropTask): void {
    const key = cellKey(maid.dimension.id, task);
    if (cellClaims.get(key) === maid.id) {
      cellClaims.delete(key);
    }
  }

  function isCellFreeFor(maid: Entity, task: CropTask): boolean {
    const owner = cellClaims.get(cellKey(maid.dimension.id, task));
    return owner === undefined || owner === maid.id;
  }

  function sameJob(job: CropTask, expected: CropTask): boolean {
    return job.x === expected.x && job.y === expected.y && job.z === expected.z;
  }

  /**
   * 走路结束。走到了才收；失败只放开这一格。切走模式时也要解开占用。
   * 使用场景：followResult 的 onComplete。
   */
  function onFollowComplete(
    maid: Entity,
    expected: CropTask,
    info: PathFollowCompleteInfo
  ): void {
    if (!maid?.isValid) {
      return;
    }
    if (EntityMaid.Work.get(maid) !== options.workId) {
      releaseCell(maid, expected);
      const job = readJob(maid);
      if (job && sameJob(job, expected)) {
        writeJob(maid, undefined);
      }
      return;
    }
    const job = readJob(maid);
    if (!job || !sameJob(job, expected)) {
      return;
    }
    if (info.reason === "done") {
      try {
        options.acquireAt(maid, job);
      } catch (e) {
        Logger.warn(options.tag, `acquireAt(onComplete): ${String(e)}`);
      }
    } else {
      Logger.info(
        options.tag,
        `follow ${info.reason} detail=${info.detail} job=${job.x},${job.y},${job.z}`
      );
    }
    releaseCell(maid, job);
    writeJob(maid, undefined);
    if (info.reason === "cancel") {
      return;
    }
    if (EntityMaid.Pose.isSitting(maid)) {
      return;
    }
    if (EntityMaid.Path.isFollowing(maid)) {
      return;
    }
    const tasks = options.collect(maid, options.claimRange);
    if (tasks.length > 0) {
      assignNext(maid, tasks);
    } else {
      SpeedController.afterSearch(
        maid,
        0,
        options.maxLack,
        options.minCount
      );
    }
  }

  /**
   * 活动圈内、同一可认领场的旁边落脚点才出发。
   * 使用场景：search 和走路结束后的下一格。
   * @returns 是否已经出发或已经在旁边收掉
   */
  function assignNext(maid: Entity, tasks: CropTask[]): boolean {
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

    const ranked = tasks
      .filter((task) => isCellFreeFor(maid, task))
      .map((task) => ({ task, d2: dist2(maid, task.x, task.z) }))
      .sort((a, b) => a.d2 - b.d2);

    for (const { task } of ranked) {
      if (!isInsideActivityCircle(circle, dim.id, task.x, task.z)) {
        continue;
      }
      if (nearCrop(maid, task)) {
        claimCell(maid, task);
        try {
          options.acquireAt(maid, task);
        } finally {
          releaseCell(maid, task);
        }
        return true;
      }

      const stands = standsBeside(probe, task).sort(
        (a, b) => dist2(maid, a.x, a.z) - dist2(maid, b.x, b.z)
      );
      let picked: StandNode | undefined;
      let waiting = false;
      for (const goal of stands) {
        if (!isInsideActivityCircle(circle, dim.id, goal.x, goal.z)) {
          continue;
        }
        ensureStandHeight(dim, goal.x, goal.y, goal.z);
        const claim = classifyFieldClaim(dim, start, goal);
        if (claim === "unready") {
          waiting = true;
          break;
        }
        if (claim !== "same") {
          continue;
        }
        if (unreachableCache.has(dim.id, goal, maid.id)) {
          continue;
        }
        picked = goal;
        break;
      }
      if (waiting) {
        return false;
      }
      if (!picked) {
        continue;
      }

      EntityMaid.Path.suppressHomeReturn(maid);
      const planned = reversiblePathResult(dim, start, picked);
      if (!planned.ok) {
        EntityMaid.Path.allowHomeReturn(maid);
        if (planned.reason === "field_unknown") {
          noteFieldUnknown(maid);
          return false;
        }
        continue;
      }

      claimCell(maid, task);
      writeJob(maid, task);
      const expected = task;
      const started = EntityMaid.Path.followResult(maid, planned, {
        onComplete: (info) => {
          onFollowComplete(maid, expected, info);
        },
      });
      if (!started) {
        EntityMaid.Path.allowHomeReturn(maid);
        releaseCell(maid, task);
        writeJob(maid, undefined);
        continue;
      }
      return true;
    }
    return false;
  }

  return {
    /**
     * 扫描并派出下一格。身上已有任务或正在走路时不重扫。
     * 使用场景：调度大约每 9 秒的搜索。
     */
    search(maid: Entity, range = 6, force = false): void {
      if (!maid?.isValid) {
        return;
      }
      if (EntityMaid.Path.isFollowing(maid)) {
        return;
      }
      if (readJob(maid)) {
        return;
      }
      let runRange = range;
      const gate = SpeedController.beforeSearch(
        maid,
        options.maxLack,
        options.lackStep
      );
      if (!force && !gate.run) {
        return;
      }
      if (gate.lackmode) {
        runRange = range + 10;
      }
      system.runJob(
        (function* () {
          if (!maid.isValid) {
            return;
          }
          const tasks = options.collect(maid, runRange);
          yield;
          if (!maid.isValid) {
            return;
          }
          SpeedController.afterSearch(
            maid,
            tasks.length,
            options.maxLack,
            options.minCount
          );
          assignNext(maid, tasks);
        })()
      );
    },

    /**
     * 调度脉冲。正在走路就等回调；人已经在作物旁边才补收。
     * 使用场景：MaidTarget.stepEvent。
     */
    onSchedulePulse(maid: Entity): void {
      if (!maid?.isValid) {
        return;
      }
      if (EntityMaid.Work.get(maid) !== options.workId) {
        return;
      }
      if (EntityMaid.Path.isFollowing(maid)) {
        return;
      }
      const job = readJob(maid);
      if (job) {
        if (!nearCrop(maid, job)) {
          return;
        }
        try {
          options.acquireAt(maid, job);
        } catch (e) {
          Logger.warn(options.tag, `acquireAt(pulse): ${String(e)}`);
        }
        releaseCell(maid, job);
        writeJob(maid, undefined);
      }
      if (!EntityMaid.Pose.isSitting(maid)) {
        const tasks = options.collect(maid, options.claimRange);
        if (tasks.length > 0) {
          assignNext(maid, tasks);
        } else {
          SpeedController.afterSearch(
            maid,
            0,
            options.maxLack,
            options.minCount
          );
        }
      }
    },
  };
}
