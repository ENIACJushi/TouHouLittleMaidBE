/**
 * Task7 Phase2：Path.follow 一键验收（临时；验收完归档卸掉，勿伤 PathFollowTest）。
 * 使用场景：`/scriptevent thlm:test path_acc_all` 搭场→放女仆→follow→等结束；
 * 日志前缀 PATHACC|，Gap 细节仍看 PATHGAP| / PATHGO|。
 */
import {
  BlockPermutation,
  Entity,
  system,
  Vector3,
} from "@minecraft/server";
import { Logger } from "../../src/controller/Logger";
import { EntityMaid } from "../../src/maid/EntityMaid";
import { PathEdgeKind, StandNode } from "../../src/maid/path/types";
import { testCommandRegister } from "../TestCommandRegister";

const TAG = "PathFollowAccept";
/** 验收汇总日志前缀（纯 console，便于 content 抓取） */
const ACC_LOG = "PATHACC";
const MAID_TYPE = "thlmm:maid";
/** 本探针生成的女仆标签，cleanup 只删这些 */
const MAID_TAG = "thlm_path_acc_maid";
/** 单用例 follow 最长等待（tick，20tick≈1s） */
const CASE_TIMEOUT_TICKS = 20 * 25;
/** 用例间隔，等落地/粒子消停 */
const CASE_GAP_TICKS = 30;

type CaseId = "flat" | "jump1" | "fall" | "gap2" | "gap3" | "gap4";

/**
 * 已铺场景的起终点与期望边类型。
 * 使用场景：runCase 对照 follow 规划结果。
 */
type BuiltCase = {
  id: CaseId;
  start: StandNode;
  goal: StandNode;
  expectKinds: PathEdgeKind[];
  forbidKinds: PathEdgeKind[];
};

/**
 * 单用例结果摘要（写入 PATHACC|SUMMARY）。
 */
type CaseSummary = {
  id: CaseId;
  planOk: boolean;
  edges: string;
  expectOk: boolean;
  followEnd: "ok" | "fail_plan" | "fail_start" | "timeout" | "maid_invalid";
  errH: number;
};

/**
 * Phase2 follow 一键验收：面前搭走廊用例并执行 Path.follow。
 * 使用场景：临时回归；测完按归档说明卸掉 BP 接线。
 */
export class PathFollowAcceptTest {
  private lastMin: Vector3 | undefined;
  private lastMax: Vector3 | undefined;
  /** 串行跑用例，防止 path_acc_all 重入 */
  private busy = false;

  constructor() {
    testCommandRegister.register("path_acc_help", (s) => this.help(s));
    testCommandRegister.register("path_acc_all", (s) => this.all(s));
    testCommandRegister.register("path_acc_flat", (s) =>
      this.runOne(s, "flat")
    );
    testCommandRegister.register("path_acc_jump1", (s) =>
      this.runOne(s, "jump1")
    );
    testCommandRegister.register("path_acc_fall", (s) =>
      this.runOne(s, "fall")
    );
    testCommandRegister.register("path_acc_gap2", (s) =>
      this.runOne(s, "gap2")
    );
    testCommandRegister.register("path_acc_gap3", (s) =>
      this.runOne(s, "gap3")
    );
    testCommandRegister.register("path_acc_gap4", (s) =>
      this.runOne(s, "gap4")
    );
    testCommandRegister.register("path_acc_cleanup", (s) => this.cleanup(s));
    Logger.info(TAG, "registered path_acc_* (temporary follow accept)");
  }

  private help(source: Entity): void {
    this.msg(
      source,
      [
        "Task7 Phase2 follow 一键验收（临时）",
        "path_acc_all — 依次 flat/jump1/fall/gap2/3/4，控制台搜 PATHACC|",
        "path_acc_flat|jump1|fall|gap2|gap3|gap4 — 单用例",
        "path_acc_cleanup — 清场景箱 + 本探针女仆",
        "面向开阔平地站好再跑；Gap 细节另搜 PATHGAP|",
      ].join("\n")
    );
  }

  private runOne(source: Entity, id: CaseId): void {
    if (this.busy) {
      this.msg(source, "busy: 上轮 path_acc 未结束");
      return;
    }
    this.busy = true;
    this.logData(`META,start,mode=single,case=${id}`);
    this.runCase(source, id, (sum) => {
      this.logData(
        `SUMMARY,${sum.id},end=${sum.followEnd},planOk=${sum.planOk},expectOk=${sum.expectOk},edges=${sum.edges},errH=${f3(sum.errH)}`
      );
      this.logData("META,end,mode=single");
      this.busy = false;
      this.msg(
        source,
        `path_acc_${id} end=${sum.followEnd} edges=${sum.edges} errH=${f3(sum.errH)}`
      );
    });
  }

  private all(source: Entity): void {
    if (this.busy) {
      this.msg(source, "busy: 上轮 path_acc 未结束");
      return;
    }
    this.busy = true;
    const ids: CaseId[] = [
      "flat",
      "jump1",
      "fall",
      "gap2",
      "gap3",
      "gap4",
    ];
    const summaries: CaseSummary[] = [];
    this.logData(`META,start,mode=all,cases=${ids.join("+")}`);
    this.msg(source, "path_acc_all 开始；完成后把含 PATHACC|/PATHGAP| 的日志发回");
    let i = 0;
    const next = () => {
      if (i >= ids.length) {
        for (const s of summaries) {
          this.logData(
            `SUMMARY,${s.id},end=${s.followEnd},planOk=${s.planOk},expectOk=${s.expectOk},edges=${s.edges},errH=${f3(s.errH)}`
          );
        }
        const pass = summaries.filter(
          (s) => s.followEnd === "ok" && s.expectOk
        ).length;
        this.logData(
          `META,end,mode=all,pass=${pass}/${summaries.length}`
        );
        this.busy = false;
        this.msg(
          source,
          `path_acc_all 完成 ${pass}/${summaries.length}；搜 PATHACC| 整段发回`
        );
        return;
      }
      const id = ids[i++];
      this.runCase(source, id, (sum) => {
        summaries.push(sum);
        system.runTimeout(next, CASE_GAP_TICKS);
      });
    };
    next();
  }

  /**
   * 铺场景 → 放置女仆 → follow → 轮询结束 → 回调摘要。
   */
  private runCase(
    source: Entity,
    id: CaseId,
    onDone: (sum: CaseSummary) => void
  ): void {
    this.clearLastBox(source);
    this.removeTaggedMaids(source);
    const facing = this.horizontalFacing(source);
    const base = this.belowFeetLoc(source.location);
    const origin = {
      x: base.x + facing.x * 2,
      y: base.y,
      z: base.z + facing.z * 2,
    };

    let built: BuiltCase;
    try {
      built = this.buildCase(source, id, origin, facing);
    } catch (e) {
      this.logData(`CASE,${id},phase=build_fail,err=${String(e)}`);
      onDone({
        id,
        planOk: false,
        edges: "(none)",
        expectOk: false,
        followEnd: "fail_plan",
        errH: NaN,
      });
      return;
    }

    this.logData(
      `CASE,${id},phase=built,start=${fmtNode(built.start)},goal=${fmtNode(built.goal)}`
    );

    const feet = {
      x: built.start.x + 0.5,
      y: built.start.y + 1,
      z: built.start.z + 0.5,
    };
    const maid = this.ensureMaid(source, feet);
    if (!maid) {
      this.logData(`CASE,${id},phase=maid_fail`);
      onDone({
        id,
        planOk: false,
        edges: "(none)",
        expectOk: false,
        followEnd: "maid_invalid",
        errH: NaN,
      });
      return;
    }

    EntityMaid.Path.cancel(maid);
    EntityMaid.Init.maid(maid);
    EntityMaid.Work.set(maid, EntityMaid.Work.idle);
    EntityMaid.Movement.unlock(maid);

    system.runTimeout(() => {
      if (!maid.isValid) {
        onDone({
          id,
          planOk: false,
          edges: "(none)",
          expectOk: false,
          followEnd: "maid_invalid",
          errH: NaN,
        });
        return;
      }
      const dest = {
        x: built.goal.x,
        y: built.goal.y,
        z: built.goal.z,
      };
      const result = EntityMaid.Path.follow(maid, dest, {
        searchH: 12,
        searchV: 6,
      });
      const edges =
        result.edges.map((e) => e.kind).join(">") || "(none)";
      const kindSet = new Set(result.edges.map((e) => e.kind));
      const missing = built.expectKinds.filter((k) => !kindSet.has(k));
      const forbidden = built.forbidKinds.filter((k) => kindSet.has(k));
      const expectOk =
        result.ok && missing.length === 0 && forbidden.length === 0;

      this.logData(
        [
          `CASE,${id},phase=follow`,
          `planOk=${result.ok}`,
          `reason=${result.reason ?? "-"}`,
          `edges=${edges}`,
          `expectOk=${expectOk}`,
          `missing=${missing.join("+") || "-"}`,
          `forbidden=${forbidden.join("+") || "-"}`,
          `maidId=${maid.id}`,
        ].join(",")
      );

      if (!result.ok) {
        onDone({
          id,
          planOk: false,
          edges,
          expectOk,
          followEnd: "fail_plan",
          errH: NaN,
        });
        return;
      }

      let waited = 0;
      const poll = () => {
        if (!maid.isValid) {
          onDone({
            id,
            planOk: true,
            edges,
            expectOk,
            followEnd: "maid_invalid",
            errH: NaN,
          });
          return;
        }
        const following = EntityMaid.Path.isFollowing(maid);
        if (!following) {
          const goalFeet = {
            x: built.goal.x + 0.5,
            y: built.goal.y + 1,
            z: built.goal.z + 0.5,
          };
          const loc = maid.location;
          const errH = Math.hypot(loc.x - goalFeet.x, loc.z - goalFeet.z);
          const errV = loc.y - goalFeet.y;
          this.logData(
            [
              `CASE,${id},phase=land`,
              `errH=${f3(errH)}`,
              `errV=${f3(errV)}`,
              `land=${f3(loc.x)},${f3(loc.y)},${f3(loc.z)}`,
              `goalFeet=${f3(goalFeet.x)},${f3(goalFeet.y)},${f3(goalFeet.z)}`,
              `waitTicks=${waited}`,
            ].join(",")
          );
          onDone({
            id,
            planOk: true,
            edges,
            expectOk,
            followEnd: "ok",
            errH,
          });
          return;
        }
        waited++;
        if (waited >= CASE_TIMEOUT_TICKS) {
          EntityMaid.Path.cancel(maid);
          this.logData(
            `CASE,${id},phase=timeout,waitTicks=${waited},edges=${edges}`
          );
          onDone({
            id,
            planOk: true,
            edges,
            expectOk,
            followEnd: "timeout",
            errH: NaN,
          });
          return;
        }
        system.runTimeout(poll, 1);
      };
      system.runTimeout(poll, 5);
    }, 10);
  }

  /**
   * 保证有一只带标签的验收女仆在起点脚位。
   */
  private ensureMaid(source: Entity, feet: Vector3): Entity | undefined {
    const dim = source.dimension;
    try {
      const maid = dim.spawnEntity(MAID_TYPE as never, feet);
      maid.addTag(MAID_TAG);
      try {
        maid.teleport(feet);
      } catch {
        /* ignore */
      }
      return maid;
    } catch (e) {
      Logger.warn(TAG, `spawn maid failed: ${String(e)}`);
      return undefined;
    }
  }

  private cleanup(source: Entity): void {
    this.clearLastBox(source);
    const n = this.removeTaggedMaids(source);
    this.busy = false;
    this.msg(source, `path_acc_cleanup maids=${n}`);
  }

  private removeTaggedMaids(source: Entity): number {
    const list = source.dimension.getEntities({
      location: source.location,
      maxDistance: 64,
      type: MAID_TYPE,
      tags: [MAID_TAG],
    });
    for (const e of list) {
      try {
        EntityMaid.Path.cancel(e);
        e.remove();
      } catch {
        /* ignore */
      }
    }
    return list.length;
  }

  private clearLastBox(source: Entity): void {
    if (this.lastMin && this.lastMax) {
      this.clearBox(source, this.lastMin, this.lastMax);
    }
    this.lastMin = undefined;
    this.lastMax = undefined;
  }

  private buildCase(
    source: Entity,
    id: CaseId,
    origin: Vector3,
    facing: { x: number; z: number }
  ): BuiltCase {
    const dim = source.dimension;
    const fx = facing.x;
    const fz = facing.z;
    const at = (n: number, dy = 0): StandNode => ({
      x: origin.x + fx * n,
      y: origin.y + dy,
      z: origin.z + fz * n,
    });

    const min = {
      x: Math.min(origin.x - 1, origin.x + fx * 10 - 1),
      y: origin.y - 2,
      z: Math.min(origin.z - 1, origin.z + fz * 10 - 1),
    };
    const max = {
      x: Math.max(origin.x + 1, origin.x + fx * 10 + 1),
      y: origin.y + 5,
      z: Math.max(origin.z + 1, origin.z + fz * 10 + 1),
    };
    this.lastMin = min;
    this.lastMax = max;
    this.clearBox(source, min, max);

    const stone = BlockPermutation.resolve("minecraft:stone");
    const air = BlockPermutation.resolve("minecraft:air");
    const set = (p: StandNode, perm: BlockPermutation) => {
      const b = dim.getBlock(p);
      if (!b) {
        throw new Error(`getBlock miss ${fmtNode(p)}`);
      }
      b.setPermutation(perm);
    };
    const pad = (p: StandNode) => {
      set(p, stone);
      set({ x: p.x, y: p.y + 1, z: p.z }, air);
      set({ x: p.x, y: p.y + 2, z: p.z }, air);
      set({ x: p.x, y: p.y + 3, z: p.z }, air);
    };

    if (id === "flat") {
      for (let i = 0; i <= 4; i++) {
        pad(at(i));
      }
      return {
        id,
        start: at(0),
        goal: at(4),
        expectKinds: ["Walk"],
        forbidKinds: ["SprintGap", "Jump1", "Fall"],
      };
    }
    if (id === "jump1") {
      for (let i = 0; i <= 2; i++) {
        pad(at(i));
      }
      pad(at(3, 1));
      return {
        id,
        start: at(0),
        goal: at(3, 1),
        expectKinds: ["Jump1"],
        forbidKinds: ["SprintGap"],
      };
    }
    if (id === "fall") {
      pad(at(0, 2));
      pad(at(1, 2));
      for (let i = 2; i <= 4; i++) {
        pad(at(i, 0));
      }
      return {
        id,
        start: at(0, 2),
        goal: at(4, 0),
        expectKinds: ["Fall"],
        forbidKinds: ["SprintGap"],
      };
    }

    const gap = id === "gap2" ? 2 : id === "gap3" ? 3 : 4;
    pad(at(0));
    pad(at(1));
    const far = 1 + gap;
    for (let i = 2; i < far; i++) {
      const p = at(i);
      set(p, air);
      set({ x: p.x, y: p.y + 1, z: p.z }, air);
      set({ x: p.x, y: p.y + 2, z: p.z }, air);
      set({ x: p.x, y: p.y + 3, z: p.z }, air);
      set({ x: p.x, y: p.y - 1, z: p.z }, air);
    }
    pad(at(far));
    pad(at(far + 1));
    return {
      id,
      start: at(1),
      goal: at(far),
      expectKinds: ["SprintGap"],
      forbidKinds: [],
    };
  }

  private clearBox(source: Entity, min: Vector3, max: Vector3): void {
    const dim = source.dimension;
    const air = BlockPermutation.resolve("minecraft:air");
    const x0 = Math.min(min.x, max.x);
    const x1 = Math.max(min.x, max.x);
    const y0 = Math.min(min.y, max.y);
    const y1 = Math.max(min.y, max.y);
    const z0 = Math.min(min.z, max.z);
    const z1 = Math.max(min.z, max.z);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        for (let z = z0; z <= z1; z++) {
          const b = dim.getBlock({ x, y, z });
          if (b) {
            try {
              b.setPermutation(air);
            } catch {
              /* ignore */
            }
          }
        }
      }
    }
  }

  private belowFeetLoc(loc: Vector3): Vector3 {
    return {
      x: Math.floor(loc.x),
      y: Math.floor(loc.y) - 1,
      z: Math.floor(loc.z),
    };
  }

  private horizontalFacing(source: Entity): { x: number; z: number } {
    try {
      const v = source.getViewDirection();
      if (Math.abs(v.x) >= Math.abs(v.z)) {
        return { x: v.x >= 0 ? 1 : -1, z: 0 };
      }
      return { x: 0, z: v.z >= 0 ? 1 : -1 };
    } catch {
      return { x: 1, z: 0 };
    }
  }

  private logData(line: string): void {
    console.log(`${ACC_LOG}|${line}`);
  }

  private msg(source: Entity, text: string): void {
    const line = `[${TAG}] ${text}`;
    const anySrc = source as Entity & { sendMessage?: (m: string) => void };
    if (typeof anySrc.sendMessage === "function") {
      anySrc.sendMessage(line);
    }
    Logger.info(TAG, text);
  }
}

function f3(n: number): string {
  return Number.isFinite(n) ? n.toFixed(3) : "NaN";
}

function fmtNode(n: StandNode): string {
  return `${n.x},${n.y},${n.z}`;
}
