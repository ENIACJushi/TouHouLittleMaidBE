/**
 * Task7：冲量→落点自动扫测（多组动量 × 每组多次，排除单次干扰）。
 * 使用场景：
 * `/scriptevent thlm:test path_imp_help`
 * `/scriptevent thlm:test path_imp_run` — 默认网格
 * `/scriptevent thlm:test path_imp_run 0.35 0.80 0.05 0.30 0.70 0.10 3`
 * `/scriptevent thlm:test path_imp_stop`
 * `/scriptevent thlm:test path_imp_dump`
 *
 * 流程：搭跑道 → 生成女仆 → 冲量 → 记轨迹/落点 → 清除女仆 → 下一组。
 * 数据打到 content 日志（CSV）；测完可归档，勿当生产逻辑。
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
import { testCommandRegister } from "../TestCommandRegister";

const TAG = "PathImpSweep";
const MAID_TYPE = "thlmm:maid";
const PAD = "minecraft:stone";
const AIR = "minecraft:air";

/** 冲量前等待（tick） */
const SETTLE_BEFORE = 6;
/** 最大飞行采样 tick */
const MAX_AIR_TICKS = 48;
/** 触地后再采几 tick，确认滑移 */
const SETTLE_AFTER = 10;
/** 采样间隔（tick）；仅存内存，默认不逐条打 TRJ 防日志限流 */
const SAMPLE_EVERY = 2;
/** 跑道长度（格，含起跳格） */
const RUNWAY_LEN = 14;
/** 起跳垫相对玩家前方偏移 */
const PAD_AHEAD = 2;
/** 纯控制台数据前缀（便于抓取，避开 § 与聊天） */
const LOG_PREFIX = "PATHIMP";

type Cardinal = { dx: number; dz: number };

type Sample = {
  t: number;
  x: number;
  y: number;
  z: number;
  onGround: boolean;
};

/** 单次试跳结果 */
type TrialResult = {
  hx: number;
  hy: number;
  trial: number;
  start: Vector3;
  land: Vector3;
  airTicks: number;
  /** 水平位移（落点 - 起点） */
  dx: number;
  dz: number;
  dy: number;
  traj: Sample[];
};

type Job = { hx: number; hy: number; trial: number };

type RunConfig = {
  hxMin: number;
  hxMax: number;
  hxStep: number;
  hyMin: number;
  hyMax: number;
  hyStep: number;
  trials: number;
};

/**
 * 冲量扫测状态机。
 * 使用场景：path_imp_run 排队执行；path_imp_stop 中止。
 */
type SweepState =
  | { kind: "idle" }
  | {
      kind: "running";
      source: Entity;
      dim: Dimension;
      dir: Cardinal;
      origin: { x: number; y: number; z: number };
      jobs: Job[];
      jobIndex: number;
      results: TrialResult[];
      maid: Entity | undefined;
      phase:
        | "spawn_wait"
        | "impulse_wait"
        | "tracking"
        | "despawn_wait";
      phaseTicks: number;
      start: Vector3 | undefined;
      traj: Sample[];
      airTicks: number;
      leftGround: boolean;
      settleLeft: number | undefined;
      handle: number;
    };

/**
 * 自动生成女仆扫测冲量—落点关系。
 * 使用场景：推导/校验 ImpulseTable；玩家朝向定轴，脚下附近搭石质跑道。
 */
export class ImpulseSweepTest {
  private state: SweepState = { kind: "idle" };

  constructor() {
    testCommandRegister.register("path_imp_help", (s) => this.help(s));
    testCommandRegister.register("path_imp_run", (s, a) => this.run(s, a));
    testCommandRegister.register("path_imp_stop", (s) => this.stop(s));
    testCommandRegister.register("path_imp_dump", (s) => this.dump(s));
    testCommandRegister.register("path_imp_dump_trj", (s) => this.dumpTrj(s));
    Logger.info(TAG, "registered path_imp_help/run/stop/dump");
  }

  private help(source: Entity): void {
    this.msg(
      source,
      [
        "冲量扫测（自动生成/清除女仆）",
        "path_imp_run — 默认 hx0.35~0.80/0.05 hy0.30~0.70/0.10 ×3次",
        "path_imp_run <hxMin> <hxMax> <hxStep> <hyMin> <hyMax> <hyStep> <trials>",
        "path_imp_stop — 中止并清女仆",
        "path_imp_dump — 控制台重打全部 IMP+SUM（PATHIMP|…）",
        "path_imp_dump_trj — 控制台重打全部 TRJ（量大）",
        "请站平地、面向跑道；抓取请搜 PATHIMP|",
      ].join("\n")
    );
  }

  private run(source: Entity, args: string[]): void {
    if (this.state.kind === "running") {
      this.msg(source, "已有扫测在跑，先 path_imp_stop");
      return;
    }
    if (!(source instanceof Player) && source.typeId !== "minecraft:player") {
      this.msg(source, "请由玩家执行");
      return;
    }
    const dir = this.cardinalFromView(source);
    if (!dir) {
      this.msg(source, "无法取朝向");
      return;
    }
    const cfg = this.parseConfig(args);
    if (!cfg) {
      this.msg(source, "参数无效；见 path_imp_help");
      return;
    }
    const jobs = this.buildJobs(cfg);
    if (jobs.length === 0) {
      this.msg(source, "任务为空");
      return;
    }
    const origin = this.originFromPlayer(source, dir);
    this.ensureRunway(source.dimension, origin, dir);
    const handle = system.runInterval(() => this.tick(), 1);
    this.state = {
      kind: "running",
      source,
      dim: source.dimension,
      dir,
      origin,
      jobs,
      jobIndex: 0,
      results: [],
      maid: undefined,
      phase: "spawn_wait",
      phaseTicks: 0,
      start: undefined,
      traj: [],
      airTicks: 0,
      leftGround: false,
      settleLeft: undefined,
      handle,
    };
    this.msg(
      source,
      `开始扫测 jobs=${jobs.length}（${cfg.trials}次/组） origin=${origin.x},${origin.y},${origin.z} dir=${dir.dx},${dir.dz}`
    );
    this.beginJob();
  }

  private stop(source: Entity): void {
    if (this.state.kind !== "running") {
      this.msg(source, "无进行中的扫测");
      return;
    }
    this.finish("stopped");
    this.msg(source, "已中止");
  }

  private dump(source: Entity): void {
    const results =
      this.state.kind === "running" ? this.state.results : this.lastResults;
    if (results.length === 0) {
      this.msg(source, "无结果");
      return;
    }
    this.emitAllImp(results);
    this.emitResults(results, source);
    this.msg(source, `dump IMP+SUM n=${results.length}（见控制台 PATHIMP|）`);
  }

  /** 按需导出轨迹（默认跑测不逐条打，避免限流） */
  private dumpTrj(source: Entity): void {
    const results =
      this.state.kind === "running" ? this.state.results : this.lastResults;
    if (results.length === 0) {
      this.msg(source, "无结果");
      return;
    }
    for (const r of results) {
      const trajStr = r.traj
        .map(
          (s) =>
            `${s.t}:${f3(s.x)}:${f3(s.y)}:${f3(s.z)}:${s.onGround ? 1 : 0}`
        )
        .join(";");
      this.logData(
        `TRJ,${r.hx},${r.hy},${r.trial},${trajStr}`
      );
    }
    this.msg(source, `dump TRJ n=${results.length}`);
  }

  /**
   * 数据行只走 console.log，避免 Logger 染色/世界聊天，降低被限流丢掉的概率。
   */
  private logData(line: string): void {
    console.log(`${LOG_PREFIX}|${line}`);
  }

  private emitAllImp(results: TrialResult[]): void {
    for (const r of results) {
      this.logData(
        `IMP,${r.hx},${r.hy},${r.trial},${f3(r.start.x)},${f3(r.start.y)},${f3(r.start.z)},${f3(r.land.x)},${f3(r.land.y)},${f3(r.land.z)},${f3(r.dx)},${f3(r.dz)},${f3(r.dy)},${r.airTicks},${r.traj.length}`
      );
    }
  }

  private parseConfig(args: string[]): RunConfig | undefined {
    if (args.length === 0) {
      return {
        hxMin: 0.35,
        hxMax: 0.8,
        hxStep: 0.05,
        hyMin: 0.3,
        hyMax: 0.7,
        hyStep: 0.1,
        trials: 3,
      };
    }
    if (args.length < 7) {
      return undefined;
    }
    const nums = args.slice(0, 7).map((a) => Number(a));
    if (nums.some((n) => !Number.isFinite(n))) {
      return undefined;
    }
    const [hxMin, hxMax, hxStep, hyMin, hyMax, hyStep, trials] = nums;
    if (hxStep <= 0 || hyStep <= 0 || trials < 1) {
      return undefined;
    }
    return {
      hxMin,
      hxMax,
      hxStep,
      hyMin,
      hyMax,
      hyStep,
      trials: Math.min(20, Math.floor(trials)),
    };
  }

  private buildJobs(cfg: RunConfig): Job[] {
    const jobs: Job[] = [];
    for (let hx = cfg.hxMin; hx <= cfg.hxMax + 1e-9; hx += cfg.hxStep) {
      for (let hy = cfg.hyMin; hy <= cfg.hyMax + 1e-9; hy += cfg.hyStep) {
        const hxR = round3(hx);
        const hyR = round3(hy);
        for (let t = 1; t <= cfg.trials; t++) {
          jobs.push({ hx: hxR, hy: hyR, trial: t });
        }
      }
    }
    return jobs;
  }

  private beginJob(): void {
    if (this.state.kind !== "running") {
      return;
    }
    const st = this.state;
    if (st.jobIndex >= st.jobs.length) {
      this.finish("done");
      return;
    }
    const job = st.jobs[st.jobIndex];
    this.despawnMaid(st);
    const feet = {
      x: st.origin.x + 0.5,
      y: st.origin.y + 1,
      z: st.origin.z + 0.5,
    };
    let maid: Entity;
    try {
      maid = st.dim.spawnEntity(MAID_TYPE as never, feet);
    } catch (e) {
      this.msg(st.source, `spawn 失败: ${String(e)}`);
      this.finish("spawn_fail");
      return;
    }
    try {
      EntityMaid.Init.maid(maid);
      EntityMaid.Work.set(maid, EntityMaid.Work.idle);
      EntityMaid.Seek.quitPursue(maid);
      EntityMaid.Seek.quit(maid);
      EntityMaid.Movement.unlock(maid);
      EntityMaid.Path.cancel(maid);
    } catch {
      /* init 部分失败仍继续 */
    }
    try {
      maid.teleport(feet, {
        facingLocation: {
          x: feet.x + st.dir.dx,
          y: feet.y,
          z: feet.z + st.dir.dz,
        },
      });
    } catch {
      /* ignore */
    }
    st.maid = maid;
    st.phase = "spawn_wait";
    st.phaseTicks = SETTLE_BEFORE;
    st.start = undefined;
    st.traj = [];
    st.airTicks = 0;
    st.leftGround = false;
    st.settleLeft = undefined;
    // 聊天少刷：每 10 个 job 报一次；控制台每 job 都有 JOB,
    if (st.jobIndex % 10 === 0) {
      this.msg(
        st.source,
        `job ${st.jobIndex + 1}/${st.jobs.length} hx=${job.hx} hy=${job.hy}`
      );
    }
    this.logData(
      `JOB,${st.jobIndex + 1},${st.jobs.length},${job.hx},${job.hy},${job.trial}`
    );
  }

  private tick(): void {
    if (this.state.kind !== "running") {
      return;
    }
    const st = this.state;
    const job = st.jobs[st.jobIndex];
    if (!job) {
      this.finish("done");
      return;
    }

    if (st.phase === "spawn_wait") {
      st.phaseTicks--;
      if (st.phaseTicks > 0) {
        return;
      }
      const maid = st.maid;
      if (!maid?.isValid) {
        this.msg(st.source, "女仆失效，跳过");
        st.jobIndex++;
        this.beginJob();
        return;
      }
      const start = { ...maid.location };
      st.start = start;
      const vx = st.dir.dx * job.hx;
      const vz = st.dir.dz * job.hx;
      try {
        maid.clearVelocity();
        maid.applyImpulse({ x: vx, y: job.hy, z: vz });
      } catch (e) {
        this.msg(st.source, `impulse 失败: ${String(e)}`);
        st.jobIndex++;
        this.beginJob();
        return;
      }
      st.phase = "tracking";
      st.airTicks = 0;
      st.leftGround = false;
      st.settleLeft = undefined;
      st.traj = [
        {
          t: 0,
          x: start.x,
          y: start.y,
          z: start.z,
          onGround: true,
        },
      ];
      return;
    }

    if (st.phase === "tracking") {
      const maid = st.maid;
      if (!maid?.isValid || !st.start) {
        st.jobIndex++;
        this.beginJob();
        return;
      }
      st.airTicks++;
      let onGround = false;
      try {
        onGround = maid.isOnGround;
      } catch {
        onGround = false;
      }
      if (!onGround) {
        st.leftGround = true;
      }
      if (st.airTicks % SAMPLE_EVERY === 0) {
        const loc = maid.location;
        st.traj.push({
          t: st.airTicks,
          x: loc.x,
          y: loc.y,
          z: loc.z,
          onGround,
        });
      }
      if (st.leftGround && onGround) {
        if (st.settleLeft === undefined) {
          st.settleLeft = SETTLE_AFTER;
        } else {
          st.settleLeft--;
          if (st.settleLeft <= 0) {
            this.recordTrial(st, job, maid.location);
            st.jobIndex++;
            st.phase = "despawn_wait";
            st.phaseTicks = 2;
          }
        }
      } else if (st.airTicks >= MAX_AIR_TICKS) {
        this.recordTrial(st, job, maid.location);
        st.jobIndex++;
        st.phase = "despawn_wait";
        st.phaseTicks = 2;
      }
      return;
    }

    if (st.phase === "despawn_wait") {
      st.phaseTicks--;
      if (st.phaseTicks > 0) {
        return;
      }
      this.beginJob();
    }
  }

  private recordTrial(
    st: Extract<SweepState, { kind: "running" }>,
    job: Job,
    land: Vector3
  ): void {
    const start = st.start ?? land;
    const result: TrialResult = {
      hx: job.hx,
      hy: job.hy,
      trial: job.trial,
      start: { ...start },
      land: { ...land },
      airTicks: st.airTicks,
      dx: land.x - start.x,
      dz: land.z - start.z,
      dy: land.y - start.y,
      traj: st.traj.slice(),
    };
    st.results.push(result);
    // 跑测中只打短 IMP；TRJ 存内存，结束或 path_imp_dump_trj 再导出
    this.logData(
      `IMP,${job.hx},${job.hy},${job.trial},${f3(start.x)},${f3(start.y)},${f3(start.z)},${f3(land.x)},${f3(land.y)},${f3(land.z)},${f3(result.dx)},${f3(result.dz)},${f3(result.dy)},${result.airTicks},${result.traj.length}`
    );
  }

  private finish(reason: string): void {
    if (this.state.kind !== "running") {
      return;
    }
    const st = this.state;
    system.clearRun(st.handle);
    this.despawnMaid(st);
    this.lastResults = st.results;
    // 结束整表重打 IMP，防止中途日志被截断
    this.logData(`META,finish,${reason},n=${st.results.length}`);
    this.emitAllImp(st.results);
    this.emitResults(st.results, st.source);
    this.msg(
      st.source,
      `扫测结束 reason=${reason} n=${st.results.length}；控制台搜 PATHIMP|`
    );
    this.state = { kind: "idle" };
  }

  /** 上次完整结果，供 path_imp_dump */
  private lastResults: TrialResult[] = [];

  private emitResults(results: TrialResult[], source: Entity): void {
    if (results.length === 0) {
      this.msg(source, "无结果");
      return;
    }
    // 按 hx,hy 聚合
    const map = new Map<string, TrialResult[]>();
    for (const r of results) {
      const k = `${r.hx}:${r.hy}`;
      const arr = map.get(k) ?? [];
      arr.push(r);
      map.set(k, arr);
    }
    for (const [k, arr] of map) {
      const mdx = mean(arr.map((a) => a.dx));
      const mdz = mean(arr.map((a) => a.dz));
      const mdy = mean(arr.map((a) => a.dy));
      const mH = mean(arr.map((a) => Math.hypot(a.dx, a.dz)));
      const sH = stdev(arr.map((a) => Math.hypot(a.dx, a.dz)));
      const line = `SUM,${k},n=${arr.length},meanH=${f3(mH)},stdH=${f3(sH)},meanDx=${f3(mdx)},meanDz=${f3(mdz)},meanDy=${f3(mdy)}`;
      this.logData(line);
    }
  }

  private despawnMaid(st: Extract<SweepState, { kind: "running" }>): void {
    const maid = st.maid;
    st.maid = undefined;
    if (!maid) {
      return;
    }
    try {
      if (maid.isValid) {
        maid.remove();
      }
    } catch {
      try {
        if (maid.isValid) {
          maid.kill();
        }
      } catch {
        /* ignore */
      }
    }
  }

  /**
   * 玩家前方 PAD_AHEAD 格为起跳支撑格原点（整数格）。
   */
  private originFromPlayer(source: Entity, dir: Cardinal): {
    x: number;
    y: number;
    z: number;
  } {
    const base = {
      x: Math.floor(source.location.x) + dir.dx * PAD_AHEAD,
      y: Math.floor(source.location.y) - 1,
      z: Math.floor(source.location.z) + dir.dz * PAD_AHEAD,
    };
    // 若脚下就是固体，用脚下一格作 y
    try {
      const under = source.dimension.getBlock({
        x: Math.floor(source.location.x),
        y: Math.floor(source.location.y) - 1,
        z: Math.floor(source.location.z),
      });
      if (under && !under.isAir) {
        base.y = under.location.y;
      }
    } catch {
      /* keep */
    }
    return base;
  }

  /**
   * 沿朝向铺石质跑道并清净空，避免蹭到杂物。
   */
  private ensureRunway(
    dim: Dimension,
    origin: { x: number; y: number; z: number },
    dir: Cardinal
  ): void {
    const stone = BlockPermutation.resolve(PAD);
    const air = BlockPermutation.resolve(AIR);
    for (let i = 0; i < RUNWAY_LEN; i++) {
      const x = origin.x + dir.dx * i;
      const z = origin.z + dir.dz * i;
      const y = origin.y;
      try {
        dim.getBlock({ x, y, z })?.setPermutation(stone);
        dim.getBlock({ x, y: y + 1, z })?.setPermutation(air);
        dim.getBlock({ x, y: y + 2, z })?.setPermutation(air);
      } catch {
        /* ignore */
      }
    }
  }

  private cardinalFromView(source: Entity): Cardinal | undefined {
    try {
      const v = source.getViewDirection();
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

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function f3(n: number): string {
  return n.toFixed(3);
}

function mean(xs: number[]): number {
  if (xs.length === 0) {
    return 0;
  }
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdev(xs: number[]): number {
  if (xs.length < 2) {
    return 0;
  }
  const m = mean(xs);
  const v = xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1);
  return Math.sqrt(v);
}
