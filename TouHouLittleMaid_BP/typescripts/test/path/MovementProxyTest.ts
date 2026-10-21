/**
 * Task7：Walk/Jump1 冲量代理原型（对照 PATHMOV 真值）。
 * 使用场景：
 * `/scriptevent thlm:test path_proxy_help`
 * `/scriptevent thlm:test path_proxy_run` — 默认 walk→jump1（用会话参数）
 * `/scriptevent thlm:test path_proxy_run walk|jump1|all [trials]`
 * `/scriptevent thlm:test path_proxy_tune` — 一次指令：测巡航→自适应找参→复核
 * `/scriptevent thlm:test path_proxy_stop`
 * `/scriptevent thlm:test path_proxy_dump`
 *
 * 行进目标速 = 实体 minecraft:movement × PATHMOV 标定比值（随等级可变）。
 * Jump1：hy=玩家起飞（默认 0.42 / path_pjump）；hx=Gap FIT；tune 只找 walk 参。
 * 数据前缀 PATHPROXY|；测完可归档，勿卸 PathFollow。
 */
import {
  BlockPermutation,
  Dimension,
  Entity,
  EntityMovementComponent,
  Player,
  system,
  Vector3,
} from "@minecraft/server";
import { Logger } from "../../src/controller/Logger";
import { EntityMaid } from "../../src/maid/EntityMaid";
import { Level } from "../../src/maid/facets/Level";
import {
  ARRIVE_LOOK_HALF_DEG,
  ARRIVE_REACH_H,
  ARRIVE_REACH_V,
  checkScriptArrive,
} from "../../src/maid/path/Arrive";
import {
  hxForHorizontalRange,
  resolveImpulseEx,
} from "../../src/maid/path/ImpulseTable";
import { testCommandRegister } from "../TestCommandRegister";
import { getLastPlayerJumpSample } from "./PlayerJumpCaptureTest";

const TAG = "PathMovProxy";
const MAID_TYPE = "thlmm:maid";
const PAD = "minecraft:stone";
const AIR = "minecraft:air";
const LOG_PREFIX = "PATHPROXY";

const SETTLE_BEFORE = 8;
const MAX_TICKS = 120;
/** 与 Arrive.ARRIVE_REACH_H 同值；稳态均值过滤用 */
const ARRIVE_H = ARRIVE_REACH_H;
/** 贴近目标时开始按距离降速（对齐采集 hDist≈0.85 起减速） */
const DECEL_H = 0.85;
const PAD_AHEAD = 2;
const WALK_LEN = 10;
const JUMP1_APPROACH = 4;
const JUMP1_PAD_LEN = 3;
/**
 * 距上台沿多远起跳（沿跑道，格）。
 * 使用场景：shouldJump。
 */
const JUMP_TRIGGER_BEFORE = 1.55;
/** 起跳后仍落在低台，允许再次起跳的间隔（tick） */
const JUMP_RETRY_AFTER = 12;
/** 单次用例最多起跳次数（含重试） */
const JUMP_MAX_ATTEMPTS = 2;
/**
 * Jump1 水平仍按 Gap 桶取距反解 hx；竖直用玩家起飞冲量（见 PLAYER_JUMP_HY）。
 * 使用场景：一次 clearVelocity + (hx,hy)。
 */
const JUMP1_PLANNED_DIST = 2;
const JUMP1_PLANNED_DY = 1;
/** 起跳瞄准水平射程下限（格），避免贴墙 actualH 过小 */
const JUMP1_MIN_TARGET_H = 1.35;
/**
 * 玩家站定起跳起飞 vy（path_pjump / 采集日志11；与 PATHMOV peakVy 一致）。
 * 使用场景：无现场 path_pjump 采样时的默认 hy；有采样则用最新 takeoffVy。
 */
const PLAYER_JUMP_HY = 0.42;

/**
 * PATHMOV@lv1 锁定真值：getVelocity 巡航与 Level.movement 的比值。
 * 使用场景：把实体定义移速换算成代理目标巡航速（两套 API 标度，非失败特例）。
 */
const PATHMOV_CRUISE_VXZ = 0.135;
const PATHMOV_DEF_MOVEMENT = Level.properties[0].movement; // 0.25
const CRUISE_PER_MOVEMENT = PATHMOV_CRUISE_VXZ / PATHMOV_DEF_MOVEMENT;
const PATHMOV_WALK_TICKS = 65;

type Cardinal = { dx: number; dz: number };
type CaseKind = "walk" | "jump1" | "calib";

/**
 * 冲量控制器可调参数（会话级；tune 写入，run 读取）。
 * 使用场景：着地 walk；Jump1 直接查 ImpulseTable，不进本结构。
 */
type DriveParams = {
  /** 实体 minecraft:movement 当前值（定义移速） */
  defMovement: number;
  /** 着地目标水平巡航 getVelocity */
  targetCruise: number;
  /** 指令速 / 显示目标速（抵消地面摩擦） */
  frictionScale: number;
  /** 加速段单 tick 沿程冲量上限 */
  maxDvAccel: number;
  /** 刹车/超速纠正单 tick 上限 */
  maxDvBrake: number;
};

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
  airTakeoffVxz: number;
  airMeanVxz: number;
  airMinVxz: number;
  start: Vector3;
  end: Vector3;
  traj: Sample[];
  tag: string;
  params: DriveParams;
};

type Job = {
  caseKind: CaseKind;
  trial: number;
  /** 日志/寻参标签，如 tune_walk#3 */
  tag: string;
  /** 本 job 覆盖的驱动参数；calib 可无 */
  params: DriveParams;
  /** true：Seek 挂追逐，不打冲量（测原版巡航） */
  vanillaPursue: boolean;
  /** tune 阶段：稀疏 SMPL，降日志量 */
  sparseLog: boolean;
};

type TunePhase = "calib" | "walk_search" | "verify" | "done";

type ProxyState =
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
      goalFeet: Vector3 | undefined;
      goalSupportY: number | undefined;
      jumped: boolean;
      jumpedAt: number | undefined;
      jumpAttempts: number;
      phase: "spawn_wait" | "tracking" | "despawn_wait";
      phaseTicks: number;
      start: Vector3 | undefined;
      traj: Sample[];
      trackTicks: number;
      airTicks: number;
      peakVy: number;
      handle: number;
      /** run | tune */
      sessionMode: "run" | "tune";
      /** 当前 job 使用的参数快照 */
      activeParams: DriveParams;
      /** tune 状态机 */
      tune:
        | undefined
        | {
            phase: TunePhase;
            walkIter: number;
            bestWalk?: { score: number; params: DriveParams; result: TrialResult };
            /** walk 自适应当前试探参数 */
            walkProbe: DriveParams;
          };
    };

/**
 * 冲量代理一键对比 / 自寻参探针。
 * 使用场景：与 path_mov_run 同地形；path_proxy_tune 一次指令收手感。
 */
export class MovementProxyTest {
  private state: ProxyState = { kind: "idle" };
  private lastResults: TrialResult[] = [];
  /**
   * 会话参数：tune 成功后写入；run 优先使用。
   * 使用场景：同世界多次 path_proxy_run 复用找参结果。
   */
  private sessionParams: DriveParams | undefined;

  constructor() {
    testCommandRegister.register("path_proxy_help", (s) => this.help(s));
    testCommandRegister.register("path_proxy_run", (s, a) => this.run(s, a));
    testCommandRegister.register("path_proxy_tune", (s) => this.tune(s));
    testCommandRegister.register("path_proxy_stop", (s) => this.stop(s));
    testCommandRegister.register("path_proxy_dump", (s) => this.dump(s));
    Logger.info(TAG, "registered path_proxy_help/run/tune/stop/dump");
  }

  private help(source: Entity): void {
    const sp = this.sessionParams;
    const spLine = sp
      ? `会话参 cruise=${f3(sp.targetCruise)} mov=${f3(sp.defMovement)} fric=${f3(sp.frictionScale)} maxDv=${f3(sp.maxDvAccel)}`
      : "会话参：尚未 tune（run 将按实体 movement×标定比值起算）";
    this.msg(
      source,
      [
        "冲量代理（对照 PATHMOV，PATHPROXY|）",
        "path_proxy_run — 默认 walk→jump1",
        "path_proxy_run walk|jump1|all [trials]",
        "path_proxy_tune — 一次：原版巡航标定→walk 自适应→复核（含 Gap Jump1）",
        "path_proxy_stop / path_proxy_dump",
        `Jump1：hy=玩家起飞（默认 ${PLAYER_JUMP_HY} / path_pjump）；hx=Gap FIT`,
        "目标巡航 = movement × " + f3(CRUISE_PER_MOVEMENT) + "（PATHMOV 比值）",
        spLine,
      ].join("\n")
    );
  }

  private run(source: Entity, args: string[]): void {
    if (this.state.kind === "running") {
      this.msg(source, "已有代理在跑，先 path_proxy_stop");
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
      this.msg(source, "参数无效；见 path_proxy_help");
      return;
    }
    const base = this.sessionParams ?? this.defaultParamsFromMovement(PATHMOV_DEF_MOVEMENT);
    const jobs = this.buildRunJobs(parsed.cases, parsed.trials, base);
    if (jobs.length === 0) {
      this.msg(source, "任务为空");
      return;
    }
    this.startSession(source, dir, jobs, "run", undefined);
    this.logData(
      `META,start,mode=run,cases=${parsed.cases.join("+")},trials=${parsed.trials},${fmtParams(base)},jump=gap:${JUMP1_PLANNED_DIST}:${JUMP1_PLANNED_DY}`
    );
    this.msg(source, `开始代理 jobs=${jobs.length} cruise=${f3(base.targetCruise)}`);
  }

  /**
   * 一次指令自寻参：calib（原版追逐巡航）→ walk 自适应 → jump 候选网格 → verify。
   * 使用场景：避免多轮改参+提日志；结果写入 sessionParams。
   */
  private tune(source: Entity): void {
    if (this.state.kind === "running") {
      this.msg(source, "已有代理在跑，先 path_proxy_stop");
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
    // 起算用 lv1 表值；calib spawn 后会按实体真实 movement 改写
    const seed = this.defaultParamsFromMovement(PATHMOV_DEF_MOVEMENT);
    const calibJob: Job = {
      caseKind: "calib",
      trial: 1,
      tag: "calib_cruise",
      params: seed,
      vanillaPursue: true,
      sparseLog: true,
    };
    const tune = {
      phase: "calib" as TunePhase,
      walkIter: 0,
      walkProbe: { ...seed },
    };
    this.startSession(source, dir, [calibJob], "tune", tune);
    this.logData(`META,start,mode=tune,phase=calib,${fmtParams(seed)},jump=gap:${JUMP1_PLANNED_DIST}:${JUMP1_PLANNED_DY}`);
    this.msg(source, "开始自寻参：calib→walk→verify（Jump1=Gap 表，搜 PATHPROXY|TUNE）");
  }

  private startSession(
    source: Entity,
    dir: Cardinal,
    jobs: Job[],
    sessionMode: "run" | "tune",
    tune:
      | undefined
      | {
          phase: TunePhase;
          walkIter: number;
          bestWalk?: { score: number; params: DriveParams; result: TrialResult };
          walkProbe: DriveParams;
        }
  ): void {
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
      jumped: false,
      jumpedAt: undefined,
      jumpAttempts: 0,
      phase: "spawn_wait",
      phaseTicks: 0,
      start: undefined,
      traj: [],
      trackTicks: 0,
      airTicks: 0,
      peakVy: 0,
      handle,
      sessionMode,
      activeParams: { ...jobs[0].params },
      tune,
    };
    this.beginJob();
  }

  private stop(source: Entity): void {
    if (this.state.kind !== "running") {
      this.msg(source, "无进行中的代理");
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
      for (const s of r.traj) {
        this.emitSmpl(r.caseKind, r.trial, r.tag, s);
      }
    }
    this.msg(source, `dump n=${results.length}（见 PATHPROXY|）`);
  }

  private parseArgs(
    args: string[]
  ): { cases: Array<"walk" | "jump1">; trials: number } | undefined {
    let cases: Array<"walk" | "jump1"> = ["walk", "jump1"];
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

  private buildRunJobs(
    cases: Array<"walk" | "jump1">,
    trials: number,
    params: DriveParams
  ): Job[] {
    const jobs: Job[] = [];
    for (const c of cases) {
      for (let t = 1; t <= trials; t++) {
        jobs.push({
          caseKind: c,
          trial: t,
          tag: `${c}#${t}`,
          params: { ...params },
          vanillaPursue: false,
          sparseLog: false,
        });
      }
    }
    return jobs;
  }

  /**
   * 由定义移速推导默认驱动参（未 tune 时的起点）。
   * 使用场景：run 无会话参；tune 自适应种子。
   */
  private defaultParamsFromMovement(defMovement: number): DriveParams {
    const targetCruise = defMovement * CRUISE_PER_MOVEMENT;
    return {
      defMovement,
      targetCruise,
      // 日志3：无放大稳态≈0.093@0.135 目标 → 比值作初值；tune 会改写
      frictionScale: PATHMOV_CRUISE_VXZ / 0.093,
      maxDvAccel: Math.max(0.03, targetCruise * 0.33),
      maxDvBrake: Math.max(0.06, targetCruise * 0.6),
    };
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

    const terrainKind = job.caseKind === "calib" ? "walk" : job.caseKind;
    const built = this.buildTerrain(st.dim, st.origin, st.dir, terrainKind);
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
      /* continue */
    }

    // 须在 lock 前读取定义移速（disableAutonomous 会把 current 钳为 0）
    const defMov = readDefMovement(maid);
    const synced: DriveParams = {
      ...job.params,
      defMovement: defMov,
      targetCruise: defMov * CRUISE_PER_MOVEMENT,
    };
    if (job.params.defMovement > 0) {
      const speedScale = synced.targetCruise / Math.max(1e-6, job.params.targetCruise);
      if (Math.abs(speedScale - 1) > 0.02) {
        synced.maxDvAccel = job.params.maxDvAccel * speedScale;
        synced.maxDvBrake = job.params.maxDvBrake * speedScale;
      }
    }
    job.params = synced;
    st.activeParams = { ...synced };

    // 冲量代理：脚本移动组 + Movement.lock（与坐下同）；calib 追逐保留寻路
    if (!job.vanillaPursue) {
      try {
        EntityMaid.Movement.disableAutonomous(maid);
      } catch {
        /* ignore */
      }
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
      }
      if (job.vanillaPursue) {
        EntityMaid.Seek.mountPursue(maid, EntityMaid.Seek.PURSUE_VIA);
      } else {
        // 冲量代理：只挂目视，之后不由脚本改朝向
        EntityMaid.Seek.mountLook(maid);
      }
    } catch (e) {
      this.msg(st.source, `Seek/marker 失败: ${String(e)}`);
    }

    // 起跑只对朝向一次；途中由 look_at_target 控头
    try {
      maid.teleport(startFeet, {
        facingLocation: {
          x: st.goalFeet.x,
          y: st.goalFeet.y,
          z: st.goalFeet.z,
        },
        keepVelocity: true,
      });
    } catch {
      /* ignore */
    }

    st.maid = maid;
    st.jumped = false;
    st.jumpedAt = undefined;
    st.jumpAttempts = 0;
    st.phase = "spawn_wait";
    st.phaseTicks = SETTLE_BEFORE;
    st.start = undefined;
    st.traj = [];
    st.trackTicks = 0;
    st.airTicks = 0;
    st.peakVy = 0;

    this.logData(
      `META,job,${st.jobIndex + 1}/${st.jobs.length},case=${job.caseKind},tag=${job.tag},trial=${job.trial},pursue=${job.vanillaPursue ? 1 : 0},${fmtParams(synced)},goal=${f3(st.goalFeet.x)},${f3(st.goalFeet.y)},${f3(st.goalFeet.z)}`
    );
    this.msg(
      st.source,
      `job ${st.jobIndex + 1}/${st.jobs.length} ${job.tag} cruise=${f3(synced.targetCruise)} mov=${f3(defMov)}`
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
      this.sampleOnce(st, maid, job, 0);
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
      if (!job.vanillaPursue) {
        this.drive(st, maid, job.caseKind === "calib" ? "walk" : job.caseKind);
      }
      this.sampleOnce(st, maid, job, st.trackTicks);

      let onGround = false;
      try {
        onGround = maid.isOnGround;
      } catch {
        onGround = false;
      }
      if (!onGround) {
        st.airTicks++;
      }

      const arrived = this.checkArrived(
        st,
        maid,
        job.caseKind === "calib" ? "walk" : job.caseKind,
        onGround
      );
      if (arrived) {
        this.recordTrial(st, job, maid.location, true, arrived);
        this.afterTrial(st);
        return;
      }
      if (st.trackTicks >= MAX_TICKS) {
        this.recordTrial(st, job, maid.location, false, "timeout");
        this.afterTrial(st);
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
   * 单 trial 结束后：run 推进队列；tune 则根据评分追加后续 job。
   * 使用场景：recordTrial 之后。
   */
  private afterTrial(st: Extract<ProxyState, { kind: "running" }>): void {
    const job = st.jobs[st.jobIndex];
    const last = st.results[st.results.length - 1];
    if (st.sessionMode === "tune" && st.tune && last) {
      this.advanceTune(st, job, last);
    } else {
      st.jobIndex++;
    }
    st.phase = "despawn_wait";
    st.phaseTicks = 2;
  }

  /**
   * tune 状态机：calib 锁定巡航 → walk 自适应 → jump 网格 → verify 写入会话。
   * 使用场景：一次 path_proxy_tune。
   */
  private advanceTune(
    st: Extract<ProxyState, { kind: "running" }>,
    job: Job,
    result: TrialResult
  ): void {
    const tune = st.tune!;
    if (tune.phase === "calib") {
      const measured = result.meanVxzSteady > 0.02 ? result.meanVxzSteady : result.params.targetCruise;
      const defMov = result.params.defMovement;
      const ratio = measured / Math.max(1e-6, defMov);
      this.logData(
        `TUNE,calib,ok=${result.ok ? 1 : 0},meanVxz=${f3(result.meanVxzSteady)},mov=${f3(defMov)},ratio=${f3(ratio)},targetCruise=${f3(measured)}`
      );
      // 以本局实测巡航为权威目标（仍与 movement 成比；比值记日志便于对照 PATHMOV）
      const seed = this.defaultParamsFromMovement(defMov);
      seed.targetCruise = measured;
      seed.maxDvAccel = Math.max(0.03, measured * 0.33);
      seed.maxDvBrake = Math.max(0.06, measured * 0.6);
      tune.walkProbe = seed;
      tune.phase = "walk_search";
      tune.walkIter = 0;
      st.jobs.push(this.makeTuneWalkJob(seed, 1));
      st.jobIndex++;
      this.msg(
        st.source,
        `TUNE calib → cruise=${f3(measured)} (mov=${f3(defMov)} ratio=${f3(ratio)})`
      );
      return;
    }

    if (tune.phase === "walk_search") {
      const score = scoreWalk(result);
      this.logData(
        `TUNE,walk,iter=${tune.walkIter},score=${f3(score)},meanVxz=${f3(result.meanVxzSteady)},ticks=${result.ticks},ok=${result.ok ? 1 : 0},${fmtParams(result.params)}`
      );
      if (!tune.bestWalk || score < tune.bestWalk.score) {
        tune.bestWalk = { score, params: { ...result.params }, result };
      }
      const target = result.params.targetCruise;
      const converged =
        result.ok &&
        Math.abs(result.meanVxzSteady - target) <= 0.008 &&
        result.ticks >= 50 &&
        result.ticks <= 95;
      tune.walkIter++;
      if (!converged && tune.walkIter < 8) {
        const next = adaptWalkParams(result.params, result);
        tune.walkProbe = next;
        st.jobs.push(this.makeTuneWalkJob(next, tune.walkIter + 1));
        st.jobIndex++;
        return;
      }
      // Jump1 用已标定 Gap 表，不再网格搜参；直接 verify
      const best = tune.bestWalk?.params ?? tune.walkProbe;
      this.sessionParams = { ...best };
      tune.phase = "verify";
      st.jobs.push({
        caseKind: "walk",
        trial: 1,
        tag: "verify_walk",
        params: { ...best },
        vanillaPursue: false,
        sparseLog: false,
      });
      st.jobs.push({
        caseKind: "jump1",
        trial: 1,
        tag: "verify_jump1",
        params: { ...best },
        vanillaPursue: false,
        sparseLog: false,
      });
      st.jobIndex++;
      this.logData(
        `TUNE,best,${fmtParams(best)},walkScore=${f3(tune.bestWalk!.score)},jump=gap:${JUMP1_PLANNED_DIST}:${JUMP1_PLANNED_DY}`
      );
      this.msg(
        st.source,
        `TUNE BEST cruise=${f3(best.targetCruise)} fric=${f3(best.frictionScale)} maxDv=${f3(best.maxDvAccel)} jump=Gap → verify`
      );
      return;
    }

    if (tune.phase === "verify") {
      this.logData(
        `TUNE,verify,tag=${job.tag},ok=${result.ok ? 1 : 0},ticks=${result.ticks},meanVxz=${f3(result.meanVxzSteady)},peakVy=${f3(result.peakVy)},air=${result.airTicks}`
      );
      st.jobIndex++;
      if (st.jobIndex >= st.jobs.length) {
        tune.phase = "done";
      }
      return;
    }

    st.jobIndex++;
  }

  private makeTuneWalkJob(params: DriveParams, iter: number): Job {
    return {
      caseKind: "walk",
      trial: iter,
      tag: `tune_walk#${iter}`,
      params: { ...params },
      vanillaPursue: false,
      sparseLog: true,
    };
  }

  /**
   * 着地限幅追巡航；Jump1 巡航带内 Gap 表一次冲量；空中不补。
   * 使用场景：tracking 每 tick，采样前执行。
   */
  private drive(
    st: Extract<ProxyState, { kind: "running" }>,
    maid: Entity,
    caseKind: "walk" | "jump1"
  ): void {
    const p = st.activeParams;
    let onGround = false;
    try {
      onGround = maid.isOnGround;
    } catch {
      onGround = false;
    }
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

    if (!onGround) {
      return;
    }

    const along = vx * st.dir.dx + vz * st.dir.dz;
    const latX = vx - along * st.dir.dx;
    const latZ = vz - along * st.dir.dz;

    if (caseKind === "jump1") {
      if (
        st.jumped &&
        st.jumpedAt !== undefined &&
        st.goalSupportY !== undefined &&
        maid.location.y < st.goalSupportY + 0.9 &&
        st.trackTicks - st.jumpedAt >= JUMP_RETRY_AFTER &&
        st.jumpAttempts < JUMP_MAX_ATTEMPTS
      ) {
        st.jumped = false;
        this.logData(`CTRL,jump_retry_arm,t=${st.trackTicks}`);
      }
      if (
        !st.jumped &&
        st.jumpAttempts < JUMP_MAX_ATTEMPTS &&
        this.shouldJump(st, maid, along)
      ) {
        this.doGapStyleJump(st, maid, vx, vy, vz);
        return;
      }
    }

    const goal = st.goalFeet!;
    const loc = maid.location;
    const hDist = Math.hypot(loc.x - goal.x, loc.z - goal.z);

    if (hDist <= ARRIVE_H) {
      if (Math.hypot(latX, latZ) > 1e-4) {
        try {
          maid.applyImpulse({ x: -latX, y: 0, z: -latZ });
        } catch {
          /* ignore */
        }
      }
      return;
    }

    let displayTarget = p.targetCruise;
    if (hDist < DECEL_H) {
      displayTarget =
        p.targetCruise * Math.max(0, (hDist - ARRIVE_H) / (DECEL_H - ARRIVE_H));
    }
    const cmdTarget = displayTarget * p.frictionScale;
    let delta = cmdTarget - along;
    if (delta > p.maxDvAccel) {
      delta = p.maxDvAccel;
    } else if (delta < -p.maxDvBrake) {
      delta = -p.maxDvBrake;
    }
    const ix = st.dir.dx * delta - latX;
    const iz = st.dir.dz * delta - latZ;
    if (Math.hypot(ix, iz) < 1e-4) {
      return;
    }
    try {
      maid.applyImpulse({ x: ix, y: 0, z: iz });
    } catch {
      /* ignore */
    }
  }

  /**
   * Jump1：竖直 = 玩家起飞 hy；水平 = Gap 距反解 hx；clear 后一次冲量。
   * 使用场景：巡航速内、距台沿 TRIGGER 窗。
   */
  private doGapStyleJump(
    st: Extract<ProxyState, { kind: "running" }>,
    maid: Entity,
    vx: number,
    vy: number,
    vz: number
  ): void {
    const toSupport = {
      x: st.origin.x + st.dir.dx * JUMP1_APPROACH,
      y: st.origin.y + 1,
      z: st.origin.z + st.dir.dz * JUMP1_APPROACH,
    };
    const fromSupport = {
      x: Math.floor(maid.location.x),
      y: st.origin.y,
      z: Math.floor(maid.location.z),
    };
    const dbg = resolveImpulseEx(
      maid.location,
      toSupport,
      JUMP1_PLANNED_DIST,
      JUMP1_PLANNED_DY,
      fromSupport
    );
    if (!dbg) {
      this.msg(st.source, "resolveImpulseEx 失败，跳过起跳");
      return;
    }
    const playerJump = getLastPlayerJumpSample();
    const hy = playerJump ? playerJump.takeoffVy : PLAYER_JUMP_HY;
    const hySrc = playerJump ? "pjump" : "player_default";
    const targetH = Math.max(dbg.actualH, JUMP1_MIN_TARGET_H);
    const hx = hxForHorizontalRange(targetH, hy);
    const ddx = dbg.toFeet.x - maid.location.x;
    const ddz = dbg.toFeet.z - maid.location.z;
    const len = Math.hypot(ddx, ddz);
    if (len < 1e-4) {
      this.msg(st.source, "起跳方向长度为 0");
      return;
    }
    const ix = (ddx / len) * hx;
    const iz = (ddz / len) * hx;
    try {
      maid.clearVelocity();
      maid.applyImpulse({ x: ix, y: hy, z: iz });
      st.jumped = true;
      st.jumpedAt = st.trackTicks;
      st.jumpAttempts += 1;
      this.logData(
        [
          `CTRL,jump`,
          `t=${st.trackTicks}`,
          `attempt=${st.jumpAttempts}`,
          `hx=${f3(hx)}`,
          `hy=${f3(hy)}`,
          `hySrc=${hySrc}`,
          `actualH=${f3(dbg.actualH)}`,
          `targetH=${f3(targetH)}`,
          `imp=${f3(ix)},${f3(hy)},${f3(iz)}`,
          `vBefore=${f3(vx)},${f3(vy)},${f3(vz)}`,
        ].join(",")
      );
    } catch (e) {
      this.msg(st.source, `jump impulse 失败: ${String(e)}`);
    }
  }

  /**
   * Jump1 起跳窗：低台、距沿合适、水平速在目标巡航带内。
   * 使用场景：drive。
   */
  private shouldJump(
    st: Extract<ProxyState, { kind: "running" }>,
    maid: Entity,
    alongVel: number
  ): boolean {
    if (st.goalSupportY === undefined) {
      return false;
    }
    const loc = maid.location;
    if (loc.y >= st.goalSupportY + 0.9) {
      return false;
    }
    const cruise = st.activeParams.targetCruise;
    const alongMin = cruise * 0.55;
    const alongMax = cruise * 1.45;
    if (alongVel < alongMin || alongVel > alongMax) {
      return false;
    }
    const along =
      (loc.x - (st.origin.x + 0.5)) * st.dir.dx +
      (loc.z - (st.origin.z + 0.5)) * st.dir.dz;
    const edge = JUMP1_APPROACH;
    return along >= edge - JUMP_TRIGGER_BEFORE && along < edge + 0.15;
  }

  private sampleOnce(
    st: Extract<ProxyState, { kind: "running" }>,
    maid: Entity,
    job: Job,
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
      /* keep */
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
    if (!job.sparseLog || t % 2 === 0 || t === 0) {
      this.emitSmpl(job.caseKind, job.trial, job.tag, s);
    }
  }

  private emitSmpl(
    caseKind: CaseKind,
    trial: number,
    tag: string,
    s: Sample
  ): void {
    this.logData(
      `SMPL,${caseKind},${trial},${tag},${s.t},${f3(s.x)},${f3(s.y)},${f3(s.z)},${f3(s.vx)},${f3(s.vy)},${f3(s.vz)},${s.onGround ? 1 : 0},${f3(s.hDist)},${f3(s.yawApprox)}`
    );
  }

  /**
   * 抵达：触及距 + 视线锥（着地）；Jump1 另要求已上一级台面。
   * 使用场景：tracking；成功 reason=`reach_cone`。
   */
  private checkArrived(
    st: Extract<ProxyState, { kind: "running" }>,
    maid: Entity,
    caseKind: "walk" | "jump1",
    onGround: boolean
  ): string | undefined {
    if (!onGround) {
      return undefined;
    }
    const goal = st.goalFeet!;
    if (caseKind === "jump1" && st.goalSupportY !== undefined) {
      if (maid.location.y < st.goalSupportY + 1 - 0.2) {
        return undefined;
      }
    }
    if (
      checkScriptArrive(maid, goal, {
        reachH: ARRIVE_REACH_H,
        reachV: ARRIVE_REACH_V,
        lookHalfDeg: ARRIVE_LOOK_HALF_DEG,
        requireOnGround: true,
      })
    ) {
      return "reach_cone";
    }
    return undefined;
  }

  private recordTrial(
    st: Extract<ProxyState, { kind: "running" }>,
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
      tag: job.tag,
      params: { ...st.activeParams },
    };
    st.results.push(result);
    this.emitSum(result);
    this.msg(
      st.source,
      `SUM ${job.tag} ok=${ok ? 1 : 0} reason=${reason} ticks=${result.ticks} meanVxz=${f3(meanVxzSteady)} air=${result.airTicks} airVxz=${f3(air.takeoff)}/${f3(air.mean)}/${f3(air.min)}`
    );
  }

  private emitSum(r: TrialResult): void {
    this.logData(
      `SUM,${r.caseKind},${r.trial},${r.tag},${r.ok ? 1 : 0},${r.ticks},${f3(r.distH)},${f3(r.peakVy)},${f3(r.meanVxzSteady)},${r.airTicks},${r.reason},airTakeoffVxz=${f3(r.airTakeoffVxz)},airMeanVxz=${f3(r.airMeanVxz)},airMinVxz=${f3(r.airMinVxz)},${fmtParams(r.params)}`
    );
  }

  private finish(reason: string): void {
    if (this.state.kind !== "running") {
      return;
    }
    const st = this.state;
    system.clearRun(st.handle);
    this.teardownActors(st);
    this.lastResults = st.results;
    this.logData(`META,finish,${reason},n=${st.results.length},mode=${st.sessionMode}`);
    if (st.sessionMode === "tune" && this.sessionParams) {
      this.logData(`TUNE,session,${fmtParams(this.sessionParams)}`);
      this.msg(
        st.source,
        `寻参结束 reason=${reason}；会话已写入 cruise=${f3(this.sessionParams.targetCruise)} fric=${f3(this.sessionParams.frictionScale)} maxDv=${f3(this.sessionParams.maxDvAccel)}；Jump1=Gap`
      );
    } else {
      this.msg(
        st.source,
        `代理结束 reason=${reason} n=${st.results.length}；搜 PATHPROXY| 对照 PATHMOV|`
      );
    }
    this.state = { kind: "idle" };
  }

  private teardownActors(st: Extract<ProxyState, { kind: "running" }>): void {
    const maid = st.maid;
    const marker = st.marker;
    const seekId = st.seekId;
    st.maid = undefined;
    st.marker = undefined;
    st.seekId = undefined;
    if (maid?.isValid) {
      try {
        EntityMaid.Seek.quitPursue(maid);
        EntityMaid.Seek.quitLook(maid);
        EntityMaid.Seek.quit(maid);
      } catch {
        /* ignore */
      }
      try {
        // 卸脚本代理组再 remove，避免残留 can_walk:false（探针会删实体，仍对称恢复）
        EntityMaid.Movement.enableAutonomous(maid);
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

  private buildTerrain(
    dim: Dimension,
    origin: { x: number; y: number; z: number },
    dir: Cardinal,
    caseKind: "walk" | "jump1"
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
    for (let i = 0; i < JUMP1_APPROACH; i++) {
      const x = origin.x + dir.dx * i;
      const z = origin.z + dir.dz * i;
      this.setPad(dim, x, origin.y, z, stone, air);
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

/**
 * 读取女仆定义移速（优先 Level 表；其次 movement 当前值且 >0）。
 * 使用场景：spawn 后、lock 前同步 targetCruise。
 */
function readDefMovement(maid: Entity): number {
  try {
    const lv = Level.get(maid);
    if (typeof lv === "number" && lv >= 1) {
      const m = Level.properties[lv - 1]?.movement;
      if (typeof m === "number" && m > 0) {
        return m;
      }
    }
  } catch {
    /* fallthrough */
  }
  try {
    const c = maid.getComponent("minecraft:movement") as
      | EntityMovementComponent
      | undefined;
    if (c) {
      const v = c.currentValue;
      if (typeof v === "number" && v > 0) {
        return v;
      }
    }
  } catch {
    /* fallthrough */
  }
  return PATHMOV_DEF_MOVEMENT;
}

/**
 * Walk 评分：稳态贴近目标巡航、时长贴近 PATHMOV、成功优先。
 * 使用场景：tune walk_search。
 */
function scoreWalk(r: TrialResult): number {
  const target = r.params.targetCruise;
  let s = 0;
  if (!r.ok) {
    s += 80;
  }
  s += Math.abs(r.meanVxzSteady - target) * 400;
  s += Math.abs(r.ticks - PATHMOV_WALK_TICKS) * 0.15;
  if (r.meanVxzSteady > target * 1.6) {
    s += 60;
  }
  if (r.ticks < 35) {
    s += 40;
  }
  return s;
}

/**
 * 根据上一 walk trial 调整摩擦与限幅（比例跟踪，非手写失败特例）。
 * 使用场景：tune walk_search 迭代。
 */
function adaptWalkParams(prev: DriveParams, r: TrialResult): DriveParams {
  const next: DriveParams = { ...prev };
  const target = prev.targetCruise;
  const mean = Math.max(r.meanVxzSteady, 1e-3);
  if (r.meanVxzSteady < target * 0.92) {
    // 偏慢：先放大摩擦指令；若已很大仍慢则放宽 maxDv
    const ratio = clamp(target / mean, 1.05, 1.45);
    next.frictionScale = clamp(prev.frictionScale * ratio, 0.8, 3.5);
    if (prev.frictionScale >= 2.8 || r.ticks >= 100) {
      next.maxDvAccel = clamp(prev.maxDvAccel * 1.2, 0.02, target * 0.9);
    }
  } else if (r.meanVxzSteady > target * 1.08 || r.ticks < 45) {
    const ratio = clamp(mean / target, 1.05, 1.4);
    next.frictionScale = clamp(prev.frictionScale / ratio, 0.8, 3.5);
    if (r.ticks < 45 || r.meanVxzSteady > target * 1.4) {
      next.maxDvAccel = clamp(prev.maxDvAccel * 0.85, 0.02, target * 0.9);
    }
  } else {
    // 稳态已近：微调时长
    if (r.ticks > 90) {
      next.maxDvAccel = clamp(prev.maxDvAccel * 1.1, 0.02, target * 0.9);
    } else if (r.ticks < 55) {
      next.maxDvAccel = clamp(prev.maxDvAccel * 0.9, 0.02, target * 0.9);
    }
  }
  next.maxDvBrake = Math.max(next.maxDvAccel * 1.6, target * 0.5);
  return next;
}

function fmtParams(p: DriveParams): string {
  return [
    `mov=${f3(p.defMovement)}`,
    `cruise=${f3(p.targetCruise)}`,
    `fric=${f3(p.frictionScale)}`,
    `maxDv=${f3(p.maxDvAccel)}`,
  ].join(",");
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function f3(n: number): string {
  return n.toFixed(3);
}

function yawFromVel(vx: number, vz: number): number | undefined {
  const h = Math.hypot(vx, vz);
  if (h < 1e-4) {
    return undefined;
  }
  return (Math.atan2(-vx, vz) * 180) / Math.PI;
}

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
  return { takeoff: speeds[0], mean: sum / speeds.length, min };
}
