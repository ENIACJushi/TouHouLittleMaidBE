/**
 * Task7：采集玩家起跳瞬间 getVelocity，供冲量代理作竖直 hy。
 * 使用场景：
 * `/scriptevent thlm:test path_pjump` — 武装后请跳一次（站定跳或走跳均可）
 * `/scriptevent thlm:test path_pjump_stop`
 * `/scriptevent thlm:test path_pjump_dump`
 *
 * 日志前缀 PATHPJUMP|；测完可归档，勿卸 PathFollow。
 */
import { Entity, Player, system, Vector3 } from "@minecraft/server";
import { Logger } from "../../src/controller/Logger";
import { testCommandRegister } from "../TestCommandRegister";

const TAG = "PathPJump";
const LOG_PREFIX = "PATHPJUMP";
/** 武装最长等待（tick）；超时自动停 */
const ARM_MAX_TICKS = 20 * 15;
/** 起飞后最多再采空中窗（取 peakVy） */
const AIR_SAMPLE_MAX = 40;

/**
 * 一次玩家起跳采样结果。
 * 使用场景：代理 Jump1 竖直冲量；dump / 会话复用。
 */
export type PlayerJumpSample = {
  /** 首帧离地水平速 √(vx²+vz²) */
  takeoffVxz: number;
  /** 首帧离地 vy（作 applyImpulse.hy） */
  takeoffVy: number;
  /** 空中窗最大 vy */
  peakVy: number;
  /** 空中采样 tick 数 */
  airTicks: number;
  takeoffVel: Vector3;
  /** 起飞时是否在跑（水平速>阈值） */
  wasMoving: boolean;
};

/**
 * 最近一次成功采样（模块级，供 MovementProxy 读取）。
 * 使用场景：path_pjump 写入；path_proxy Jump1 读 hy。
 */
let lastSample: PlayerJumpSample | undefined;

/**
 * 读取最近玩家起跳采样（无则 undefined）。
 * 使用场景：MovementProxyTest.doGapStyleJump 竖直分量。
 */
export function getLastPlayerJumpSample(): PlayerJumpSample | undefined {
  return lastSample;
}

/**
 * 玩家起跳冲量采集探针。
 * 使用场景：站定按空格，对照 maid 代理 hy。
 */
export class PlayerJumpCaptureTest {
  private handle: number | undefined;
  private source: Entity | undefined;
  private phase: "idle" | "wait_takeoff" | "air" = "idle";
  private armTicks = 0;
  private wasOnGround = true;
  private airTicks = 0;
  private peakVy = 0;
  private takeoffVel: Vector3 | undefined;

  constructor() {
    testCommandRegister.register("path_pjump_help", (s) => this.help(s));
    testCommandRegister.register("path_pjump", (s) => this.arm(s));
    testCommandRegister.register("path_pjump_stop", (s) => this.stop(s));
    testCommandRegister.register("path_pjump_dump", (s) => this.dump(s));
    Logger.info(TAG, "registered path_pjump_help/pjump/stop/dump");
  }

  private help(source: Entity): void {
    const s = lastSample;
    const last = s
      ? `上次 hy≈${f3(s.takeoffVy)} peakVy=${f3(s.peakVy)} vxz=${f3(s.takeoffVxz)}`
      : "尚无采样";
    this.msg(
      source,
      [
        "玩家起跳采集（PATHPJUMP|）",
        "path_pjump — 武装后跳一次（建议站定跳）",
        "path_pjump_stop / path_pjump_dump",
        "采到的 takeoffVy 供 path_proxy Jump1 作 hy",
        last,
      ].join("\n")
    );
  }

  /**
   * 武装：等玩家离地一帧记起飞速，再采空中 peakVy。
   * 使用场景：path_pjump。
   */
  private arm(source: Entity): void {
    if (!(source instanceof Player) && source.typeId !== "minecraft:player") {
      this.msg(source, "请由玩家执行");
      return;
    }
    if (this.phase !== "idle") {
      this.msg(source, "已在采集，先 path_pjump_stop 或等本次结束");
      return;
    }
    this.source = source;
    this.phase = "wait_takeoff";
    this.armTicks = 0;
    this.airTicks = 0;
    this.peakVy = 0;
    this.takeoffVel = undefined;
    try {
      this.wasOnGround = source.isOnGround;
    } catch {
      this.wasOnGround = true;
    }
    this.handle = system.runInterval(() => this.tick(), 1);
    this.logData("META,arm,maxTicks=" + ARM_MAX_TICKS);
    this.msg(source, "已武装：请跳一次（站定最佳）；超时 15s");
  }

  private stop(source: Entity): void {
    if (this.phase === "idle") {
      this.msg(source, "无进行中的采集");
      return;
    }
    this.clearTimer();
    this.phase = "idle";
    this.logData("META,stop");
    this.msg(source, "已中止");
  }

  private dump(source: Entity): void {
    if (!lastSample) {
      this.msg(source, "无结果");
      return;
    }
    this.emitSum(lastSample);
    this.msg(
      source,
      `dump hy=${f3(lastSample.takeoffVy)} peakVy=${f3(lastSample.peakVy)} vxz=${f3(lastSample.takeoffVxz)} move=${lastSample.wasMoving ? 1 : 0}`
    );
  }

  private tick(): void {
    const src = this.source;
    if (!src?.isValid || this.phase === "idle") {
      this.clearTimer();
      this.phase = "idle";
      return;
    }
    this.armTicks++;
    if (this.armTicks > ARM_MAX_TICKS) {
      this.logData("META,timeout");
      this.msg(src, "超时未跳到，已停");
      this.clearTimer();
      this.phase = "idle";
      return;
    }

    let onGround = true;
    let vx = 0;
    let vy = 0;
    let vz = 0;
    try {
      onGround = src.isOnGround;
      const v = src.getVelocity();
      vx = v.x;
      vy = v.y;
      vz = v.z;
    } catch {
      return;
    }

    if (this.phase === "wait_takeoff") {
      if (this.wasOnGround && !onGround) {
        this.takeoffVel = { x: vx, y: vy, z: vz };
        this.peakVy = vy;
        this.airTicks = 1;
        this.phase = "air";
        this.logData(
          `TAKEOFF,vx=${f3(vx)},vy=${f3(vy)},vz=${f3(vz)},vxz=${f3(Math.hypot(vx, vz))},isJumping=${(src as Player).isJumping ? 1 : 0}`
        );
        this.msg(src, `起飞 vy=${f3(vy)} vxz=${f3(Math.hypot(vx, vz))}，采空中峰…`);
      }
      this.wasOnGround = onGround;
      return;
    }

    if (this.phase === "air") {
      if (vy > this.peakVy) {
        this.peakVy = vy;
      }
      this.airTicks++;
      this.logData(
        `SMPL,t=${this.airTicks},vx=${f3(vx)},vy=${f3(vy)},vz=${f3(vz)},onG=${onGround ? 1 : 0}`
      );
      const done = onGround || this.airTicks >= AIR_SAMPLE_MAX;
      if (!done) {
        return;
      }
      const tv = this.takeoffVel!;
      const takeoffVxz = Math.hypot(tv.x, tv.z);
      const sample: PlayerJumpSample = {
        takeoffVxz,
        takeoffVy: tv.y,
        peakVy: this.peakVy,
        airTicks: this.airTicks,
        takeoffVel: { ...tv },
        wasMoving: takeoffVxz > 0.05,
      };
      lastSample = sample;
      this.emitSum(sample);
      this.msg(
        src,
        `完成 hy=${f3(sample.takeoffVy)} peakVy=${f3(sample.peakVy)} vxz=${f3(sample.takeoffVxz)}；path_proxy Jump1 将用此 hy`
      );
      this.clearTimer();
      this.phase = "idle";
    }
  }

  private emitSum(s: PlayerJumpSample): void {
    this.logData(
      `SUM,hy=${f3(s.takeoffVy)},peakVy=${f3(s.peakVy)},takeoffVxz=${f3(s.takeoffVxz)},airTicks=${s.airTicks},moving=${s.wasMoving ? 1 : 0},vx=${f3(s.takeoffVel.x)},vy=${f3(s.takeoffVel.y)},vz=${f3(s.takeoffVel.z)}`
    );
  }

  private clearTimer(): void {
    if (this.handle !== undefined) {
      system.clearRun(this.handle);
      this.handle = undefined;
    }
    this.source = undefined;
  }

  private logData(line: string): void {
    console.log(`${LOG_PREFIX}|${line}`);
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
  return n.toFixed(3);
}
