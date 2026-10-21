/**
 * Task7：原版 Walk / Jump1 运动学采集（Seek+追逐真值，供后续冲量代理拟合）。
 * 使用场景：
 * `/scriptevent thlm:test path_mov_help`
 * `/scriptevent thlm:test path_mov_run` — 默认 walk→jump1 各 1 次
 * `/scriptevent thlm:test path_mov_run walk|jump1|all [trials]`
 * `/scriptevent thlm:test path_mov_stop`
 * `/scriptevent thlm:test path_mov_dump`
 *
 * 起跑：一次 facingLocation、不清速度；之后 look_at_target（追逐组内）控头。
 * 数据前缀 PATHMOV|（纯 console）；测完可归档卸线，勿卸 PathFollow。
 */
import {
  BlockPermutation,
  Dimension,
  Entity,
  EntityHitEntityAfterEvent,
  Player,
  system,
  Vector3,
  world,
} from "@minecraft/server";
import { Logger } from "../../src/controller/Logger";
import { EntityMaid } from "../../src/maid/EntityMaid";
import { testCommandRegister } from "../TestCommandRegister";

const TAG = "PathMovCapture";
const MAID_TYPE = "thlmm:maid";
const PAD = "minecraft:stone";
const AIR = "minecraft:air";
/** 纯控制台数据前缀 */
const LOG_PREFIX = "PATHMOV";

/** 挂 Seek 后等待 NAT/追逐生效（tick） */
const SETTLE_BEFORE = 8;
/** 单次用例最大采样 tick */
const MAX_TICKS = 120;
/** 与 Executor ARRIVE_VIA_H 对齐，便于对照 */
const ARRIVE_H = 0.75;
/** 竖直抵达容差 */
const ARRIVE_V = 1.6;
/** 跑道相对玩家前方偏移 */
const PAD_AHEAD = 2;
/** walk 平道长度（格，含起点） */
const WALK_LEN = 10;
/** jump1：起跑道长度后再上台 */
const JUMP1_APPROACH = 4;
/** jump1：上台面沿前进方向垫长 */
const JUMP1_PAD_LEN = 3;

type Cardinal = { dx: number; dz: number };
type CaseKind = "walk" | "jump1";

/**
 * 单 tick 采样点。
 * 使用场景：PATHMOV|SMPL；dump 重放。
 */
type Sample = {
  t: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  onGround: boolean;
  hDist: number;
  yawApprox: number;
};

/**
 * 单次用例汇总。
 * 使用场景：PATHMOV|SUM；稳态速/空中水平速诊断（Jump1 代理关键）。
 */
type TrialResult = {
  caseKind: CaseKind;
  trial: number;
  ok: boolean;
  ticks: number;
  distH: number;
  peakVy: number;
  meanVxzSteady: number;
  airTicks: number;
  reason: string;
  /** 首帧离地水平速；无空中为 0 */
  airTakeoffVxz: number;
  /** 空中窗水平速均值；无空中为 0 */
  airMeanVxz: number;
  /** 空中窗水平速最小；无空中为 0 */
  airMinVxz: number;
  start: Vector3;
  end: Vector3;
  traj: Sample[];
};

type Job = { caseKind: CaseKind; trial: number };

/**
 * 采集状态机。
 * 使用场景：path_mov_run 排队；path_mov_stop 中止。
 */
type CaptureState =
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
      seekId: number | undefined;
      marker: Entity | undefined;
      /** 目标脚位（格心） */
      goalFeet: Vector3 | undefined;
      /** jump1 上台面支撑 Y（整数） */
      goalSupportY: number | undefined;
      hitMarker: boolean;
      /** 本会话 entityHitEntity 回调；teardown 时 unsubscribe */
      hitSub: ((ev: EntityHitEntityAfterEvent) => void) | undefined;
      phase: "spawn_wait" | "tracking" | "despawn_wait";
      phaseTicks: number;
      start: Vector3 | undefined;
      traj: Sample[];
      trackTicks: number;
      airTicks: number;
      peakVy: number;
      leftGround: boolean;
      handle: number;
    };

/**
 * 原版 Walk/Jump1 运动采集。
 * 使用场景：拟合脚本代理前采真值；玩家朝向定轴搭场。
 */
export class MovementCaptureTest {
  private state: CaptureState = { kind: "idle" };
  /** 上次完整结果，供 path_mov_dump */
  private lastResults: TrialResult[] = [];

  constructor() {
    testCommandRegister.register("path_mov_help", (s) => this.help(s));
    testCommandRegister.register("path_mov_run", (s, a) => this.run(s, a));
    testCommandRegister.register("path_mov_stop", (s) => this.stop(s));
    testCommandRegister.register("path_mov_dump", (s) => this.dump(s));
    Logger.info(TAG, "registered path_mov_help/run/stop/dump");
  }

  private help(source: Entity): void {
    this.msg(
      source,
      [
        "原版 Walk/Jump1 运动采集（Seek+追逐，PATHMOV|）",
        "path_mov_run — 默认 walk→jump1 各 1 次",
        "path_mov_run walk|jump1|all [trials]",
        "path_mov_stop — 中止并清探针女仆",
        "path_mov_dump — 控制台重打 SUM+SMPL",
        "站平地面向跑道；抓取搜 PATHMOV|",
      ].join("\n")
    );
  }

  private run(source: Entity, args: string[]): void {
    if (this.state.kind === "running") {
      this.msg(source, "已有采集在跑，先 path_mov_stop");
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
    const parsed = this.parseArgs(args);
    if (!parsed) {
      this.msg(source, "参数无效；见 path_mov_help");
      return;
    }
    const jobs = this.buildJobs(parsed.cases, parsed.trials);
    if (jobs.length === 0) {
      this.msg(source, "任务为空");
      return;
    }
    const origin = this.originFromPlayer(source, dir);
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
      seekId: undefined,
      marker: undefined,
      goalFeet: undefined,
      goalSupportY: undefined,
      hitMarker: false,
      hitSub: undefined,
      phase: "spawn_wait",
      phaseTicks: 0,
      start: undefined,
      traj: [],
      trackTicks: 0,
      airTicks: 0,
      peakVy: 0,
      leftGround: false,
      handle,
    };
    this.logData(
      `META,start,cases=${parsed.cases.join("+")},trials=${parsed.trials},jobs=${jobs.length},seek=on,pursue=on`
    );
    this.msg(
      source,
      `开始采集 jobs=${jobs.length} origin=${origin.x},${origin.y},${origin.z} dir=${dir.dx},${dir.dz}`
    );
    this.beginJob();
  }

  private stop(source: Entity): void {
    if (this.state.kind !== "running") {
      this.msg(source, "无进行中的采集");
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
    for (const r of results) {
      this.emitSum(r);
      this.emitTraj(r);
    }
    this.msg(source, `dump n=${results.length}（见控制台 PATHMOV|）`);
  }

  /**
   * 解析 path_mov_run 参数。
   * 使用场景：默认 all×1；显式 walk|jump1|all 与 trials。
   */
  private parseArgs(
    args: string[]
  ): { cases: CaseKind[]; trials: number } | undefined {
    let cases: CaseKind[] = ["walk", "jump1"];
    let trials = 1;
    if (args.length === 0) {
      return { cases, trials };
    }
    const kind = args[0].toLowerCase();
    if (kind === "walk") {
      cases = ["walk"];
    } else if (kind === "jump1") {
      cases = ["jump1"];
    } else if (kind === "all") {
      cases = ["walk", "jump1"];
    } else {
      return undefined;
    }
    if (args.length >= 2) {
      const t = Number(args[1]);
      if (!Number.isFinite(t) || t < 1) {
        return undefined;
      }
      trials = Math.min(10, Math.floor(t));
    }
    return { cases, trials };
  }

  private buildJobs(cases: CaseKind[], trials: number): Job[] {
    const jobs: Job[] = [];
    for (const c of cases) {
      for (let t = 1; t <= trials; t++) {
        jobs.push({ caseKind: c, trial: t });
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
    this.teardownActors(st);

    const built = this.buildTerrain(st.dim, st.origin, st.dir, job.caseKind);
    st.goalFeet = built.goalFeet;
    st.goalSupportY = built.goalSupportY;

    const startFeet = {
      x: st.origin.x + 0.5,
      y: st.origin.y + 1,
      z: st.origin.z + 0.5,
    };
    let maid: Entity;
    try {
      maid = st.dim.spawnEntity(MAID_TYPE as never, startFeet);
    } catch (e) {
      this.msg(st.source, `spawn 失败: ${String(e)}`);
      this.finish("spawn_fail");
      return;
    }
    try {
      EntityMaid.Init.maid(maid);
      EntityMaid.Work.set(maid, EntityMaid.Work.idle);
      EntityMaid.Movement.unlock(maid);
      EntityMaid.Path.cancel(maid);
    } catch {
      /* init 部分失败仍继续 */
    }

    const seekId = EntityMaid.Seek.allocate();
    if (seekId === undefined) {
      this.msg(st.source, "Seek 槽位已满");
      this.finish("seek_full");
      return;
    }
    st.seekId = seekId;
    try {
      const marker = st.dim.spawnEntity(
        EntityMaid.Seek.MARKER_TYPE as never,
        st.goalFeet
      );
      EntityMaid.Seek.stamp(marker, seekId);
      st.marker = marker;
      if (!EntityMaid.Seek.mount(maid, seekId)) {
        this.msg(st.source, "Seek.mount 失败");
      } else {
        // walk/jump1 用途经追逐贴紧走，抵达靠距离或命中
        EntityMaid.Seek.mountPursue(maid, EntityMaid.Seek.PURSUE_VIA);
      }
    } catch (e) {
      this.msg(st.source, `Seek/marker 失败: ${String(e)}`);
    }

    // 契约：一次 facingLocation，不清速度
    try {
      maid.teleport(startFeet, {
        facingLocation: {
          x: st.goalFeet.x,
          y: st.goalFeet.y,
          z: st.goalFeet.z,
        },
      });
    } catch {
      /* ignore */
    }

    st.maid = maid;
    st.hitMarker = false;
    this.bindHit(st, maid);
    st.phase = "spawn_wait";
    st.phaseTicks = SETTLE_BEFORE;
    st.start = undefined;
    st.traj = [];
    st.trackTicks = 0;
    st.airTicks = 0;
    st.peakVy = 0;
    st.leftGround = false;

    this.logData(
      `META,job,${st.jobIndex + 1}/${st.jobs.length},case=${job.caseKind},trial=${job.trial},goal=${f3(st.goalFeet.x)},${f3(st.goalFeet.y)},${f3(st.goalFeet.z)}`
    );
    this.msg(
      st.source,
      `job ${st.jobIndex + 1}/${st.jobs.length} ${job.caseKind}#${job.trial}`
    );
  }

  /**
   * 订阅本会话近战命中 marker（与 Executor 终点语义对照）。
   * 使用场景：tracking 期间 hitMarker=true 可提前结束。
   */
  private bindHit(
    st: Extract<CaptureState, { kind: "running" }>,
    maid: Entity
  ): void {
    this.unbindHit(st);
    const handler = (ev: EntityHitEntityAfterEvent): void => {
      if (this.state.kind !== "running") {
        return;
      }
      const cur = this.state;
      if (cur.maid !== maid || !cur.marker?.isValid) {
        return;
      }
      try {
        if (
          ev.damagingEntity?.id === maid.id &&
          ev.hitEntity.id === cur.marker.id
        ) {
          cur.hitMarker = true;
        }
      } catch {
        /* ignore */
      }
    };
    st.hitSub = handler;
    try {
      // entities = 攻击方女仆（与 Executor.bindHitListener 一致）
      world.afterEvents.entityHitEntity.subscribe(handler, {
        entities: [maid],
      });
    } catch (e) {
      st.hitSub = undefined;
      Logger.warn(TAG, `bindHit failed: ${String(e)}`);
    }
  }

  private unbindHit(st: Extract<CaptureState, { kind: "running" }>): void {
    if (!st.hitSub) {
      return;
    }
    try {
      world.afterEvents.entityHitEntity.unsubscribe(st.hitSub);
    } catch {
      /* ignore */
    }
    st.hitSub = undefined;
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
      if (!maid?.isValid || !st.goalFeet) {
        this.msg(st.source, "女仆失效，跳过");
        st.jobIndex++;
        this.beginJob();
        return;
      }
      st.start = { ...maid.location };
      st.phase = "tracking";
      st.trackTicks = 0;
      st.traj = [];
      st.airTicks = 0;
      st.peakVy = 0;
      st.leftGround = false;
      this.sampleOnce(st, maid, 0);
      return;
    }

    if (st.phase === "tracking") {
      const maid = st.maid;
      if (!maid?.isValid || !st.start || !st.goalFeet) {
        st.jobIndex++;
        this.beginJob();
        return;
      }
      st.trackTicks++;
      this.sampleOnce(st, maid, st.trackTicks);

      let onGround = false;
      try {
        onGround = maid.isOnGround;
      } catch {
        onGround = false;
      }
      if (!onGround) {
        st.leftGround = true;
        st.airTicks++;
      }

      const arrived = this.checkArrived(st, maid, job.caseKind, onGround);
      if (arrived) {
        this.recordTrial(st, job, maid.location, true, arrived);
        st.jobIndex++;
        st.phase = "despawn_wait";
        st.phaseTicks = 2;
        return;
      }
      if (st.trackTicks >= MAX_TICKS) {
        this.recordTrial(st, job, maid.location, false, "timeout");
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

  /**
   * 采一点并打 PATHMOV|SMPL。
   * 使用场景：tracking 每 tick。
   */
  private sampleOnce(
    st: Extract<CaptureState, { kind: "running" }>,
    maid: Entity,
    t: number
  ): void {
    const loc = maid.location;
    let vx = 0;
    let vy = 0;
    let vz = 0;
    try {
      const v = maid.getVelocity();
      vx = v.x;
      vy = v.y;
      vz = v.z;
    } catch {
      /* keep 0 */
    }
    if (vy > st.peakVy) {
      st.peakVy = vy;
    }
    const goal = st.goalFeet!;
    const hDist = Math.hypot(loc.x - goal.x, loc.z - goal.z);
    let yawApprox = yawFromVel(vx, vz);
    if (yawApprox === undefined && st.traj.length > 0) {
      const prev = st.traj[st.traj.length - 1];
      yawApprox = yawFromVel(loc.x - prev.x, loc.z - prev.z) ?? 0;
    }
    if (yawApprox === undefined) {
      yawApprox = 0;
    }
    let onGround = false;
    try {
      onGround = maid.isOnGround;
    } catch {
      onGround = false;
    }
    const s: Sample = {
      t,
      x: loc.x,
      y: loc.y,
      z: loc.z,
      vx,
      vy,
      vz,
      onGround,
      hDist,
      yawApprox,
    };
    st.traj.push(s);
    this.logData(
      `SMPL,${st.jobs[st.jobIndex].caseKind},${st.jobs[st.jobIndex].trial},${t},${f3(s.x)},${f3(s.y)},${f3(s.z)},${f3(s.vx)},${f3(s.vy)},${f3(s.vz)},${s.onGround ? 1 : 0},${f3(s.hDist)},${f3(s.yawApprox)}`
    );
  }

  /**
   * 抵达：距离阈或命中 marker；jump1 还要求脚已上台。
   * 使用场景：tracking 结束判定。
   */
  private checkArrived(
    st: Extract<CaptureState, { kind: "running" }>,
    maid: Entity,
    caseKind: CaseKind,
    onGround: boolean
  ): string | undefined {
    const goal = st.goalFeet!;
    const loc = maid.location;
    const h = Math.hypot(loc.x - goal.x, loc.z - goal.z);
    const vOk = Math.abs(loc.y - goal.y) <= ARRIVE_V;
    if (caseKind === "jump1" && st.goalSupportY !== undefined) {
      // 脚部位于上台面之上（支撑顶 + 一点容差）
      if (loc.y < st.goalSupportY + 1 - 0.2) {
        return undefined;
      }
    }
    if (st.hitMarker && vOk) {
      return "hit_marker";
    }
    if (h <= ARRIVE_H && vOk && onGround) {
      return "near";
    }
    return undefined;
  }

  private recordTrial(
    st: Extract<CaptureState, { kind: "running" }>,
    job: Job,
    end: Vector3,
    ok: boolean,
    reason: string
  ): void {
    const start = st.start ?? end;
    const distH = Math.hypot(end.x - start.x, end.z - start.z);
    const meanVxzSteady = computeSteadyMean(st.traj, ARRIVE_H);
    const air = computeAirVxz(st.traj);
    const result: TrialResult = {
      caseKind: job.caseKind,
      trial: job.trial,
      ok,
      ticks: st.trackTicks,
      distH,
      peakVy: st.peakVy,
      meanVxzSteady,
      airTicks: st.airTicks,
      reason,
      airTakeoffVxz: air.takeoff,
      airMeanVxz: air.mean,
      airMinVxz: air.min,
      start: { ...start },
      end: { ...end },
      traj: st.traj.slice(),
    };
    st.results.push(result);
    this.emitSum(result);
    this.msg(
      st.source,
      `SUM ${job.caseKind}#${job.trial} ok=${ok ? 1 : 0} reason=${reason} ticks=${result.ticks} meanVxz=${f3(meanVxzSteady)} air=${result.airTicks} airVxz=${f3(air.takeoff)}/${f3(air.mean)}/${f3(air.min)}`
    );
  }

  private emitSum(r: TrialResult): void {
    this.logData(
      `SUM,${r.caseKind},${r.trial},${r.ok ? 1 : 0},${r.ticks},${f3(r.distH)},${f3(r.peakVy)},${f3(r.meanVxzSteady)},${r.airTicks},${r.reason},airTakeoffVxz=${f3(r.airTakeoffVxz)},airMeanVxz=${f3(r.airMeanVxz)},airMinVxz=${f3(r.airMinVxz)}`
    );
  }

  private emitTraj(r: TrialResult): void {
    for (const s of r.traj) {
      this.logData(
        `SMPL,${r.caseKind},${r.trial},${s.t},${f3(s.x)},${f3(s.y)},${f3(s.z)},${f3(s.vx)},${f3(s.vy)},${f3(s.vz)},${s.onGround ? 1 : 0},${f3(s.hDist)},${f3(s.yawApprox)}`
      );
    }
  }

  private finish(reason: string): void {
    if (this.state.kind !== "running") {
      return;
    }
    const st = this.state;
    system.clearRun(st.handle);
    this.teardownActors(st);
    this.lastResults = st.results;
    this.logData(`META,finish,${reason},n=${st.results.length}`);
    for (const r of st.results) {
      this.emitSum(r);
    }
    this.msg(
      st.source,
      `采集结束 reason=${reason} n=${st.results.length}；控制台搜 PATHMOV|`
    );
    this.state = { kind: "idle" };
  }

  private teardownActors(
    st: Extract<CaptureState, { kind: "running" }>
  ): void {
    this.unbindHit(st);
    const maid = st.maid;
    const marker = st.marker;
    const seekId = st.seekId;
    st.maid = undefined;
    st.marker = undefined;
    st.seekId = undefined;
    if (maid?.isValid) {
      try {
        EntityMaid.Seek.quitPursue(maid);
        EntityMaid.Seek.quit(maid);
      } catch {
        /* ignore */
      }
    }
    if (marker?.isValid) {
      try {
        EntityMaid.Seek.release(marker);
        marker.remove();
      } catch {
        try {
          if (marker.isValid) {
            marker.kill();
          }
        } catch {
          /* ignore */
        }
      }
    }
    if (seekId !== undefined) {
      try {
        EntityMaid.Seek.free(seekId);
      } catch {
        /* ignore */
      }
    }
    if (maid?.isValid) {
      try {
        maid.remove();
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
  }

  /**
   * 搭 walk 平道或 jump1 台阶，返回目标脚位与上台支撑 Y。
   * 使用场景：beginJob。
   */
  private buildTerrain(
    dim: Dimension,
    origin: { x: number; y: number; z: number },
    dir: Cardinal,
    caseKind: CaseKind
  ): { goalFeet: Vector3; goalSupportY: number } {
    const stone = BlockPermutation.resolve(PAD);
    const air = BlockPermutation.resolve(AIR);
    if (caseKind === "walk") {
      for (let i = 0; i < WALK_LEN; i++) {
        const x = origin.x + dir.dx * i;
        const z = origin.z + dir.dz * i;
        this.setPad(dim, x, origin.y, z, stone, air);
      }
      const gi = WALK_LEN - 1;
      return {
        goalFeet: {
          x: origin.x + dir.dx * gi + 0.5,
          y: origin.y + 1,
          z: origin.z + dir.dz * gi + 0.5,
        },
        goalSupportY: origin.y,
      };
    }
    // jump1：前段平道，再抬高 1 的石台
    for (let i = 0; i < JUMP1_APPROACH; i++) {
      const x = origin.x + dir.dx * i;
      const z = origin.z + dir.dz * i;
      this.setPad(dim, x, origin.y, z, stone, air);
      // 清掉可能残留的高台
      try {
        dim.getBlock({ x, y: origin.y + 1, z })?.setPermutation(air);
        dim.getBlock({ x, y: origin.y + 2, z })?.setPermutation(air);
        dim.getBlock({ x, y: origin.y + 3, z })?.setPermutation(air);
      } catch {
        /* ignore */
      }
    }
    const topY = origin.y + 1;
    for (let i = 0; i < JUMP1_PAD_LEN; i++) {
      const x = origin.x + dir.dx * (JUMP1_APPROACH + i);
      const z = origin.z + dir.dz * (JUMP1_APPROACH + i);
      try {
        dim.getBlock({ x, y: origin.y, z })?.setPermutation(stone);
        dim.getBlock({ x, y: topY, z })?.setPermutation(stone);
        dim.getBlock({ x, y: topY + 1, z })?.setPermutation(air);
        dim.getBlock({ x, y: topY + 2, z })?.setPermutation(air);
      } catch {
        /* ignore */
      }
    }
    const gi = JUMP1_APPROACH + JUMP1_PAD_LEN - 1;
    return {
      goalFeet: {
        x: origin.x + dir.dx * gi + 0.5,
        y: topY + 1,
        z: origin.z + dir.dz * gi + 0.5,
      },
      goalSupportY: topY,
    };
  }

  private setPad(
    dim: Dimension,
    x: number,
    y: number,
    z: number,
    stone: BlockPermutation,
    air: BlockPermutation
  ): void {
    try {
      dim.getBlock({ x, y, z })?.setPermutation(stone);
      dim.getBlock({ x, y: y + 1, z })?.setPermutation(air);
      dim.getBlock({ x, y: y + 2, z })?.setPermutation(air);
    } catch {
      /* ignore */
    }
  }

  private originFromPlayer(
    source: Entity,
    dir: Cardinal
  ): { x: number; y: number; z: number } {
    const base = {
      x: Math.floor(source.location.x) + dir.dx * PAD_AHEAD,
      y: Math.floor(source.location.y) - 1,
      z: Math.floor(source.location.z) + dir.dz * PAD_AHEAD,
    };
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

/**
 * 由水平速度估 yaw（度，Minecraft 风格近似：0=+z）。
 * 使用场景：SMPL.yawApprox；速度过小返回 undefined。
 */
function yawFromVel(vx: number, vz: number): number | undefined {
  const h = Math.hypot(vx, vz);
  if (h < 1e-4) {
    return undefined;
  }
  return (Math.atan2(-vx, vz) * 180) / Math.PI;
}

/**
 * 着地且 hDist 仍大于抵达阈时，取后半程水平速均值。
 * 使用场景：SUM.meanVxzSteady。
 */
function computeSteadyMean(traj: Sample[], arriveH: number): number {
  const grounded = traj.filter((s) => s.onGround && s.hDist > arriveH);
  if (grounded.length === 0) {
    return 0;
  }
  const from = Math.floor(grounded.length / 2);
  const win = grounded.slice(from);
  if (win.length === 0) {
    return 0;
  }
  let sum = 0;
  for (const s of win) {
    sum += Math.hypot(s.vx, s.vz);
  }
  return sum / win.length;
}

/**
 * 空中窗水平速：起飞首帧 / 均值 / 最小。
 * 使用场景：Jump1 SUM；观察离地后水平速是否被掐断。
 */
function computeAirVxz(traj: Sample[]): {
  takeoff: number;
  mean: number;
  min: number;
} {
  const air = traj.filter((s) => !s.onGround);
  if (air.length === 0) {
    return { takeoff: 0, mean: 0, min: 0 };
  }
  const speeds = air.map((s) => Math.hypot(s.vx, s.vz));
  let sum = 0;
  let min = speeds[0];
  for (const h of speeds) {
    sum += h;
    if (h < min) {
      min = h;
    }
  }
  return {
    takeoff: speeds[0],
    mean: sum / speeds.length,
    min,
  };
}
