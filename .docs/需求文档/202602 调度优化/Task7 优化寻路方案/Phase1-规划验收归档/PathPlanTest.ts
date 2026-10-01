/**
 * Task7 Phase1：寻路规划验收（仅 find/canReach，不执行 follow）。
 * 使用场景：`/scriptevent thlm:test path_*`；测完归档，勿常驻生产。
 *
 * 用例：平地 Walk、Jump1、Fall、宽 2～4 SprintGap。
 */
import {
  BlockPermutation,
  Entity,
  Player,
  system,
  Vector3,
} from "@minecraft/server";
import { Logger } from "../../src/controller/Logger";
import { EntityMaid } from "../../src/maid/EntityMaid";
import { PathEdgeKind, StandNode } from "../../src/maid/path/types";
import { testCommandRegister } from "../TestCommandRegister";

const TAG = "PathPlan";
/** 验收标记盔甲架 */
const MARK_TAG = "thlm_path_plan";

type CaseId = "flat" | "jump1" | "fall" | "gap2" | "gap3" | "gap4";

/**
 * 已铺场景的起终点与期望。
 * 使用场景：runCase 对照 Path.findNodes 结果。
 */
type BuiltCase = {
  id: CaseId;
  start: StandNode;
  goal: StandNode;
  /** 路径中须出现的边类型（子集即可） */
  expectKinds: PathEdgeKind[];
  /** 路径中禁止出现的边类型 */
  forbidKinds: PathEdgeKind[];
};

/**
 * 规划验收命令注册器。
 */
export class PathPlanTest {
  /** 最近一次铺场景的包围盒，供 cleanup 清方块 */
  private lastMin: Vector3 | undefined;
  private lastMax: Vector3 | undefined;

  constructor() {
    testCommandRegister.register("path_help", (s) => this.help(s));
    testCommandRegister.register("path_flat", (s) => this.runCase(s, "flat"));
    testCommandRegister.register("path_jump1", (s) => this.runCase(s, "jump1"));
    testCommandRegister.register("path_fall", (s) => this.runCase(s, "fall"));
    testCommandRegister.register("path_gap2", (s) => this.runCase(s, "gap2"));
    testCommandRegister.register("path_gap3", (s) => this.runCase(s, "gap3"));
    testCommandRegister.register("path_gap4", (s) => this.runCase(s, "gap4"));
    testCommandRegister.register("path_all", (s) => this.all(s));
    testCommandRegister.register("path_look", (s) => this.look(s));
    testCommandRegister.register("path_cleanup", (s) => this.cleanup(s));
    Logger.info(TAG, "registered path_* plan accept commands");
  }

  private help(source: Entity): void {
    this.msg(
      source,
      [
        "Task7 Phase1 规划验收（只 find，不 follow）",
        "path_flat / path_jump1 / path_fall — 平走、上1、下落",
        "path_gap2 / path_gap3 / path_gap4 — 空谷 SprintGap",
        "path_all — 依次跑全部用例",
        "path_look — 从脚下寻到看向方块",
        "path_cleanup — 清标记 + 最近场景箱",
      ].join("\n")
    );
  }

  private all(source: Entity): void {
    const ids: CaseId[] = ["flat", "jump1", "fall", "gap2", "gap3", "gap4"];
    let i = 0;
    const next = () => {
      if (i >= ids.length) {
        this.msg(source, "path_all 完成");
        return;
      }
      const id = ids[i++];
      this.runCase(source, id);
      system.runTimeout(next, 15);
    };
    next();
  }

  /**
   * 铺场景 → findNodes → 打印 PASS/FAIL。
   */
  private runCase(source: Entity, id: CaseId): void {
    this.cleanup(source);
    const facing = this.horizontalFacing(source);
    const base = this.belowFeetLoc(source.location);
    // 走廊起点：面前 2 格的支撑顶面
    const origin = {
      x: base.x + facing.x * 2,
      y: base.y,
      z: base.z + facing.z * 2,
    };

    let built: BuiltCase;
    try {
      built = this.buildCase(source, id, origin, facing);
    } catch (e) {
      this.msg(source, `${id} 铺场景失败: ${String(e)}`);
      return;
    }

    this.spawnMark(source, built.start, `S:${id}`);
    this.spawnMark(source, built.goal, `G:${id}`);

    const result = EntityMaid.Path.findNodes(
      source.dimension,
      built.start,
      built.goal,
      { searchH: 12, searchV: 6 }
    );

    const kinds = result.edges.map((e) => e.kind);
    const kindSet = new Set(kinds);
    const missing = built.expectKinds.filter((k) => !kindSet.has(k));
    const forbidden = built.forbidKinds.filter((k) => kindSet.has(k));
    const pass =
      result.ok && missing.length === 0 && forbidden.length === 0;

    const lines = [
      `case=${id} ok=${result.ok} reason=${result.reason ?? "-"}`,
      `start=${fmtNode(built.start)} goal=${fmtNode(built.goal)}`,
      `edges=${kinds.length ? kinds.join(">") : "(none)"}`,
      `nodes=${result.nodes.length}`,
      missing.length ? `缺边类型: ${missing.join(",")}` : "",
      forbidden.length ? `禁边出现: ${forbidden.join(",")}` : "",
      pass ? "PASS" : "FAIL",
    ].filter(Boolean);

    this.msg(source, lines.join("\n"));
  }

  /**
   * 看向方块作终点（规划冒烟）。
   */
  private look(source: Entity): void {
    const destBlock = this.resolveLookBlock(source);
    if (!destBlock) {
      this.msg(source, "path_look: 无看向方块");
      return;
    }
    const result = EntityMaid.Path.find(
      source.dimension,
      source.location,
      destBlock.location,
      { searchH: 16, searchV: 6 }
    );
    const kinds = result.edges.map((e) => e.kind);
    this.msg(
      source,
      [
        `look dest=${destBlock.typeId} @${fmtNode({
          x: Math.floor(destBlock.location.x),
          y: Math.floor(destBlock.location.y),
          z: Math.floor(destBlock.location.z),
        })}`,
        `ok=${result.ok} reason=${result.reason ?? "-"} edges=${kinds.join(">") || "(none)"}`,
        result.ok ? "PASS" : "FAIL",
      ].join("\n")
    );
  }

  private cleanup(source: Entity): void {
    const stands = source.dimension.getEntities({
      location: source.location,
      maxDistance: 64,
      type: "minecraft:armor_stand",
      tags: [MARK_TAG],
    });
    for (const e of stands) {
      try {
        e.remove();
      } catch {
        /* ignore */
      }
    }
    if (this.lastMin && this.lastMax) {
      this.clearBox(source, this.lastMin, this.lastMax);
    }
    this.msg(source, `cleanup: markers=${stands.length}`);
  }

  // —— 场景建造 ——

  private buildCase(
    source: Entity,
    id: CaseId,
    origin: Vector3,
    facing: { x: number; z: number }
  ): BuiltCase {
    const dim = source.dimension;
    const fx = facing.x;
    const fz = facing.z;

    /** 沿面向前进 n 格的支撑坐标 */
    const at = (n: number, dy = 0): StandNode => ({
      x: origin.x + fx * n,
      y: origin.y + dy,
      z: origin.z + fz * n,
    });

    // 预留走廊：长 10、宽 3、高 6
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

    /** 铺支撑 + 头上 3 格空气 */
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
      // 台阶底座也要有，否则 jump 目标支撑悬空——at(3,1) 已是支撑格
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

    // gap2/3/4：两岸平台，中间空谷（无支撑）
    const gap = id === "gap2" ? 2 : id === "gap3" ? 3 : 4;
    pad(at(0));
    pad(at(1));
    // 中间 1..gap-1 相对起点岸内侧：岸在 0,1；对岸在 1+gap
    const far = 1 + gap;
    for (let i = 2; i < far; i++) {
      // 挖空：不放支撑；保证身位空气
      const p = at(i);
      set(p, air);
      set({ x: p.x, y: p.y + 1, z: p.z }, air);
      set({ x: p.x, y: p.y + 2, z: p.z }, air);
      set({ x: p.x, y: p.y + 3, z: p.z }, air);
      // 谷底再低一格空气，避免误站
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

  private spawnMark(source: Entity, support: StandNode, name: string): void {
    try {
      const e = source.dimension.spawnEntity("minecraft:armor_stand" as never, {
        x: support.x + 0.5,
        y: support.y + 1,
        z: support.z + 0.5,
      });
      e.addTag(MARK_TAG);
      e.nameTag = name;
    } catch {
      /* ignore */
    }
  }

  private resolveLookBlock(source: Entity) {
    if (source instanceof Player || source.typeId === "minecraft:player") {
      try {
        return (source as Player).getBlockFromViewDirection({ maxDistance: 16 })
          ?.block;
      } catch {
        return undefined;
      }
    }
    return undefined;
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

  private msg(source: Entity, text: string): void {
    const line = `[${TAG}] ${text}`;
    const anySrc = source as Entity & { sendMessage?: (m: string) => void };
    if (typeof anySrc.sendMessage === "function") {
      anySrc.sendMessage(line);
    }
    Logger.info(TAG, text);
  }
}

function fmtNode(n: StandNode): string {
  return `${n.x},${n.y},${n.z}`;
}
