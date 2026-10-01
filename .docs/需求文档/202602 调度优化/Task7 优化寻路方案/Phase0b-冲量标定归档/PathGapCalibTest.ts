/**
 * Task7 Phase0b：SprintGap 冲量标定台（永久保留，填表用）。
 * 使用场景：
 * `/scriptevent thlm:test path_gap_help`
 * `/scriptevent thlm:test path_gap_build 3 1` — 按朝向搭起跳/对岸/挖空谷
 * `/scriptevent thlm:test path_gap_try 3 0` — 检查并搭建后试跳
 * `/scriptevent thlm:test path_gap_try 3 0 0.72 0.48`
 * `/scriptevent thlm:test path_gap_set 3 0 0.75 0.50`
 * `/scriptevent thlm:test path_gap_dump`
 *
 * 约定：最近女仆为起跳者；玩家水平朝向定轴；try 前自动 ensure 地形并把女仆放到起跳格。
 */
import {
  BlockPermutation,
  Dimension,
  Entity,
  Player,
  system,
  Vector3,
} from "@minecraft/server";
import { Logger } from "../../src/controller/Logger";
import { EntityMaid } from "../../src/maid/EntityMaid";
import {
  ImpulseKey,
  ImpulseVec,
  lookupImpulse,
  overrideImpulse,
  snapshotImpulseTable,
} from "../../src/maid/path/ImpulseTable";
import { testCommandRegister } from "../TestCommandRegister";

const TAG = "PathGapCalib";
const MAID_TYPE = "thlmm:maid";
/** 飞行观测超时（tick）；与 Executor FLIGHT_TIMEOUT 同量级 */
const FLIGHT_TICKS = 40;
/** 落地判定：相对期望脚位水平容差 */
const LAND_H = 1.25;
/** 竖直容差（收紧，避免无高差地形时 errV=±1 仍报 OK） */
const LAND_V = 0.75;
/** 标定台用实心块 */
const PAD_BLOCK = "minecraft:stone";
const AIR_BLOCK = "minecraft:air";
/** 搭地形后稍等再冲量，避免未同步 */
const BUILD_SETTLE_TICKS = 8;
/** 落地后继续观测的稳定 tick 数（防惯性滑出对岸误报 OK） */
const SETTLE_TICKS = 12;

type BlockPos = { x: number; y: number; z: number };
type Cardinal = { dx: number; dz: number };

/**
 * 冲量标定会话：试跳后轮询落地并汇报误差。
 */
type TrySession = {
  maidId: string;
  expectedFeet: Vector3;
  /** 期望对岸支撑格 y，用于校验是否真的落到目标高度 */
  expectSupportY: number;
  dist: 2 | 3 | 4;
  dy: -1 | 0 | 1;
  vec: ImpulseVec;
  source: Entity;
  ticksLeft: number;
  /** 已触地后剩余稳定观测 tick；undefined 表示尚未触地 */
  settleLeft: number | undefined;
};

/**
 * Phase0b 冲量标定命令集。
 * 使用场景：自动搭 Gap 地形后试跳；调通后 dump 回写 ImpulseTable。
 */
export class PathGapCalibTest {
  private active: TrySession | undefined;

  constructor() {
    testCommandRegister.register("path_gap_help", (s) => this.help(s));
    testCommandRegister.register("path_gap_build", (s, a) => this.buildOnly(s, a));
    testCommandRegister.register("path_gap_try", (s, a) => this.tryJump(s, a));
    testCommandRegister.register("path_gap_set", (s, a) => this.setBucket(s, a));
    testCommandRegister.register("path_gap_dump", (s) => this.dump(s));
    Logger.info(TAG, "registered path_gap_help/build/try/set/dump");
  }

  private help(source: Entity): void {
    this.msg(
      source,
      [
        "Task7 Phase0b Gap 冲量标定",
        "1) 附近有女仆，玩家朝向对岸",
        "2) path_gap_build <dist> <dy> — 只搭地形（起跳石台/对岸/挖空谷）并传送女仆",
        "3) path_gap_try <dist> <dy> [hx] [hy] — 检查并搭建后试跳",
        "4) 欠水平加大 hx；偏低加大 hy；OK 后 path_gap_set",
        "5) path_gap_dump — 打印可粘贴表",
        "注意：dy=±1 会对岸抬高/降低一格；对岸仅一格（真实落点）；过头减 hx；勿毁保留建筑",
      ].join("\n")
    );
  }

  /**
   * 仅搭建标定地形并把女仆放到起跳格。
   */
  private buildOnly(source: Entity, args: string[]): void {
    const parsed = this.parseDistDy(args);
    if (!parsed) {
      this.msg(source, "用法: path_gap_build <dist> <dy>");
      return;
    }
    const maid = this.nearestMaid(source);
    if (!maid) {
      this.msg(source, "附近无女仆");
      return;
    }
    const dir = this.cardinalFromView(source);
    if (!dir) {
      this.msg(source, "无法取玩家朝向（请本人执行）");
      return;
    }
    const from = supportUnder(maid.location);
    const built = this.ensureGapTerrain(maid.dimension, from, dir, parsed.dist, parsed.dy);
    this.teleportMaidToPad(maid, from);
    this.msg(
      source,
      [
        `build ${parsed.dist}:${parsed.dy} dir=${dir.dx},${dir.dz}`,
        `from=${fmtPos(from)} to=${fmtPos(built.to)}`,
        `cleared=${built.cleared} pads=stone；女仆已放到起跳格`,
      ].join("\n")
    );
  }

  private tryJump(source: Entity, args: string[]): void {
    const parsed = this.parseDistDy(args);
    if (!parsed) {
      this.msg(source, "用法: path_gap_try <dist> <dy> [hx] [hy]");
      return;
    }
    const { dist, dy } = parsed;
    let vec = lookupImpulse(dist, dy);
    if (args.length >= 4) {
      const hx = Number(args[2]);
      const hy = Number(args[3]);
      if (!Number.isFinite(hx) || !Number.isFinite(hy)) {
        this.msg(source, "hx/hy 须为数字");
        return;
      }
      vec = { hx, hy };
    }
    if (!vec) {
      this.msg(source, `无冲量表项 ${dist}:${dy}`);
      return;
    }

    const maid = this.nearestMaid(source);
    if (!maid) {
      this.msg(source, "附近无女仆");
      return;
    }
    const dir = this.cardinalFromView(source);
    if (!dir) {
      this.msg(source, "无法取玩家朝向（请本人执行）");
      return;
    }

    EntityMaid.Path.cancel(maid);
    EntityMaid.Seek.quitPursue(maid);
    EntityMaid.Seek.quit(maid);

    const from = supportUnder(maid.location);
    const built = this.ensureGapTerrain(maid.dimension, from, dir, dist, dy);
    this.teleportMaidToPad(maid, from);

    const expectedFeet = {
      x: built.to.x + 0.5,
      y: built.to.y + 1,
      z: built.to.z + 0.5,
    };
    const vx = dir.dx * vec.hx;
    const vz = dir.dz * vec.hx;

    this.msg(
      source,
      [
        `try ${dist}:${dy} hx=${vec.hx.toFixed(3)} hy=${vec.hy.toFixed(3)}`,
        `terrain from=${fmtPos(from)} to=${fmtPos(built.to)} cleared=${built.cleared}`,
        `等待 ${BUILD_SETTLE_TICKS}tick 后冲量…`,
      ].join("\n")
    );

    system.runTimeout(() => {
      if (!maid.isValid) {
        this.msg(source, "try: 女仆已失效");
        return;
      }
      // 传送后重读支撑，防止错位
      const fromNow = supportUnder(maid.location);
      if (fromNow.x !== from.x || fromNow.z !== from.z) {
        this.teleportMaidToPad(maid, from);
      }
      try {
        maid.clearVelocity();
        maid.applyImpulse({ x: vx, y: vec.hy, z: vz });
      } catch (e) {
        this.msg(source, `impulse 失败: ${String(e)}`);
        return;
      }
      this.active = {
        maidId: maid.id,
        expectedFeet,
        expectSupportY: built.to.y,
        dist,
        dy,
        vec: { ...vec },
        source,
        ticksLeft: FLIGHT_TICKS,
        settleLeft: undefined,
      };
      this.pollLand(maid);
    }, BUILD_SETTLE_TICKS);
  }

  /**
   * 检查并搭建 SprintGap 标定地形：起跳/对岸各一格石台 + 中间空谷净空（与真实 Gap 落点一致，不加长对岸）。
   * 使用场景：path_gap_build / path_gap_try。
   */
  private ensureGapTerrain(
    dim: Dimension,
    from: BlockPos,
    dir: Cardinal,
    dist: 2 | 3 | 4,
    dy: -1 | 0 | 1
  ): { to: BlockPos; cleared: number } {
    const to: BlockPos = {
      x: from.x + dir.dx * dist,
      y: from.y + dy,
      z: from.z + dir.dz * dist,
    };
    const yLo = Math.min(from.y, to.y);
    const yHi = Math.max(from.y, to.y);
    let cleared = 0;

    // 起跳 / 对岸：各仅一格支撑（对齐正式路径落点）
    for (const p of [from, to]) {
      this.setBlock(dim, p.x, p.y, p.z, PAD_BLOCK);
      cleared += this.setBlock(dim, p.x, p.y + 1, p.z, AIR_BLOCK) ? 1 : 0;
      cleared += this.setBlock(dim, p.x, p.y + 2, p.z, AIR_BLOCK) ? 1 : 0;
    }

    // 中间柱：挖掉可能成支撑的层 + 身位（对齐 edges.isGapClear）
    for (let step = 1; step < dist; step++) {
      const ix = from.x + dir.dx * step;
      const iz = from.z + dir.dz * step;
      for (let y = yLo; y <= yHi + 2; y++) {
        if (this.setBlock(dim, ix, y, iz, AIR_BLOCK)) {
          cleared++;
        }
      }
    }
    return { to, cleared };
  }

  /**
   * 写方块；成功返回 true（忽略越界等异常）。
   */
  private setBlock(
    dim: Dimension,
    x: number,
    y: number,
    z: number,
    typeId: string
  ): boolean {
    try {
      dim.setBlockPermutation(
        { x, y, z },
        BlockPermutation.resolve(typeId)
      );
      return true;
    } catch {
      return false;
    }
  }

  private teleportMaidToPad(maid: Entity, support: BlockPos): void {
    try {
      maid.teleport(
        { x: support.x + 0.5, y: support.y + 1, z: support.z + 0.5 },
        { dimension: maid.dimension }
      );
      maid.clearVelocity();
    } catch {
      /* ignore */
    }
  }

  private pollLand(maid: Entity): void {
    system.runTimeout(() => {
      const session = this.active;
      if (!session || session.maidId !== maid.id) {
        return;
      }
      if (!maid.isValid) {
        this.finishTry(session, "maid_invalid");
        return;
      }

      let onGround = false;
      try {
        onGround = maid.isOnGround;
      } catch {
        onGround = false;
      }

      // 已进入稳定期：继续倒数，中途离地则改判滑落
      if (session.settleLeft !== undefined) {
        if (!onGround) {
          this.finishTry(session, "slip_off", maid);
          return;
        }
        session.settleLeft--;
        if (session.settleLeft <= 0) {
          this.finishTry(session, "landed", maid);
          return;
        }
        this.pollLand(maid);
        return;
      }

      session.ticksLeft--;
      if (onGround) {
        session.settleLeft = SETTLE_TICKS;
        this.pollLand(maid);
        return;
      }
      if (session.ticksLeft <= 0) {
        this.finishTry(session, "timeout", maid);
        return;
      }
      this.pollLand(maid);
    }, 1);
  }

  private finishTry(
    session: TrySession,
    reason: string,
    maid?: Entity
  ): void {
    this.active = undefined;
    const m = maid && maid.isValid ? maid : undefined;
    if (m) {
      try {
        EntityMaid.Movement.unlock(m);
      } catch {
        /* ignore */
      }
    }
    if (!m) {
      this.msg(session.source, `try 结束 reason=${reason}（无实体）`);
      return;
    }
    const loc = m.location;
    const exp = session.expectedFeet;
    const errH = Math.hypot(loc.x - exp.x, loc.z - exp.z);
    const errV = loc.y - exp.y;
    const landSupportY = supportUnder(loc).y;
    const heightMatch = landSupportY === session.expectSupportY;
    // 惯性滑出对岸一律失败（即使采样瞬间仍在容差内）
    const ok =
      reason !== "slip_off" &&
      errH <= LAND_H &&
      Math.abs(errV) <= LAND_V &&
      heightMatch;
    let hint: string;
    if (!heightMatch) {
      hint = `高度未达对岸支撑(y=${session.expectSupportY} 实为 ${landSupportY})→调 hy 或检查地形`;
    } else if (reason === "slip_off") {
      hint = "惯性滑出对岸→减小 hx 后重试";
    } else if (errH > LAND_H) {
      hint = "水平不足→加大 hx；过头→减小 hx";
    } else if (Math.abs(errV) > LAND_V) {
      hint = errV < 0 ? "偏低→加大 hy" : "偏高→减小 hy";
    } else {
      hint = "落点可接受，可 path_gap_set 固化";
    }
    this.msg(
      session.source,
      [
        `result ${session.dist}:${session.dy} ${reason} ${ok ? "OK" : "MISS"}`,
        `land=${fmtVec(loc)} expect=${fmtVec(exp)} supportY=${landSupportY}/${session.expectSupportY}`,
        `errH=${errH.toFixed(2)} errV=${errV.toFixed(2)}`,
        `used hx=${session.vec.hx} hy=${session.vec.hy}`,
        hint,
      ].join("\n")
    );
  }

  private setBucket(source: Entity, args: string[]): void {
    const parsed = this.parseDistDy(args);
    if (!parsed || args.length < 4) {
      this.msg(source, "用法: path_gap_set <dist> <dy> <hx> <hy>");
      return;
    }
    const hx = Number(args[2]);
    const hy = Number(args[3]);
    if (!Number.isFinite(hx) || !Number.isFinite(hy)) {
      this.msg(source, "hx/hy 须为数字");
      return;
    }
    overrideImpulse(parsed.dist, parsed.dy, { hx, hy });
    this.msg(
      source,
      `set ${parsed.dist}:${parsed.dy} = { hx: ${hx}, hy: ${hy} }（仅内存，dump 后请写回源码）`
    );
  }

  private dump(source: Entity): void {
    const snap = snapshotImpulseTable();
    const keys = Object.keys(snap).sort() as ImpulseKey[];
    const lines = keys.map((k) => {
      const v = snap[k];
      return `  "${k}": { hx: ${v.hx}, hy: ${v.hy} },`;
    });
    this.msg(source, ["ImpulseTable 当前值（可粘贴）:", ...lines].join("\n"));
  }

  private parseDistDy(
    args: string[]
  ): { dist: 2 | 3 | 4; dy: -1 | 0 | 1 } | undefined {
    if (args.length < 2) {
      return undefined;
    }
    const dist = Number(args[0]);
    const dy = Number(args[1]);
    if (dist !== 2 && dist !== 3 && dist !== 4) {
      return undefined;
    }
    if (dy !== -1 && dy !== 0 && dy !== 1) {
      return undefined;
    }
    return { dist: dist as 2 | 3 | 4, dy: dy as -1 | 0 | 1 };
  }

  private nearestMaid(source: Entity): Entity | undefined {
    const list = source.dimension.getEntities({
      location: source.location,
      maxDistance: 32,
      type: MAID_TYPE,
    });
    if (list.length === 0) {
      return undefined;
    }
    list.sort((a, b) => {
      const da = dist2(source.location, a.location);
      const db = dist2(source.location, b.location);
      return da - db;
    });
    return list[0];
  }

  /**
   * 玩家水平朝向映射到轴对齐单位向量（与 SprintGap 边一致）。
   */
  private cardinalFromView(source: Entity): Cardinal | undefined {
    if (!(source instanceof Player) && source.typeId !== "minecraft:player") {
      return undefined;
    }
    try {
      const v = (source as Player).getViewDirection();
      if (Math.abs(v.x) >= Math.abs(v.z)) {
        return { dx: v.x >= 0 ? 1 : -1, dz: 0 };
      }
      return { dx: 0, dz: v.z >= 0 ? 1 : -1 };
    } catch {
      return undefined;
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

/** 脚下方支撑格（与 Path Executor 节点约定对齐） */
function supportUnder(loc: Vector3): BlockPos {
  return {
    x: Math.floor(loc.x),
    y: Math.floor(loc.y - 1e-3),
    z: Math.floor(loc.z),
  };
}

function fmtPos(p: BlockPos): string {
  return `${p.x},${p.y},${p.z}`;
}

function fmtVec(v: Vector3): string {
  return `${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)}`;
}

function dist2(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number }
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}
