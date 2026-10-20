/**
 * Task7：Walk/Jump1 冲量代理原型（对照 PATHMOV 真值）。
 * 使用场景：
 * `/scriptevent thlm:test path_proxy_help`
 * `/scriptevent thlm:test path_proxy_run` — 默认 walk→jump1
 * `/scriptevent thlm:test path_proxy_run walk|jump1|all [trials]`
 * `/scriptevent thlm:test path_proxy_stop`
 * `/scriptevent thlm:test path_proxy_dump`
 *
 * 本阶段：Seek 索敌+marker，不挂追逐（无 melee）；起跑一次 facingLocation 不清速；
 * 位移全靠 applyImpulse。目视组拆分前，连续 look_at_target 尚未挂载。
 * 控制量取自 PATHMOV 复测 + Gap ImpulseTable（见实验设计 §7/§8），非失败用例特例。
 * 数据前缀 PATHPROXY|；测完可归档，勿卸 PathFollow。
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
  hxForHorizontalRange,
  lookupImpulse,
  resolveImpulseEx,
} from "../../src/maid/path/ImpulseTable";
import { testCommandRegister } from "../TestCommandRegister";

const TAG = "PathMovProxy";
const MAID_TYPE = "thlmm:maid";
const PAD = "minecraft:stone";
const AIR = "minecraft:air";
const LOG_PREFIX = "PATHPROXY";

const SETTLE_BEFORE = 8;
const MAX_TICKS = 120;
const ARRIVE_H = 0.75;
const ARRIVE_V = 1.6;
/** 贴近目标时开始按距离降速（对齐采集 hDist≈0.85 起减速） */
const DECEL_H = 0.85;
const PAD_AHEAD = 2;
const WALK_LEN = 10;
const JUMP1_APPROACH = 4;
const JUMP1_PAD_LEN = 3;

/**
 * 平地巡航水平速（PATHMOV 复测 meanVxzSteady）。
 * 使用场景：着地冲量跟踪目标速。
 */
const TARGET_VXZ = 0.135;
/**
 * 日志3：cmd=TARGET 增益1 时稳态≈0.093；指令速放大使稳态贴近 PATHMOV。
 * 使用场景：walk 冲量目标 = TARGET_VXZ * 此比值（非单次失败特例）。
 */
const WALK_FRICTION_CMD_SCALE = TARGET_VXZ / 0.093;
/**
 * 加速段单 tick 沿程冲量上限（日志3 稳态所需约 0.042；日志5 用 0.02 卡在 vz≈0.044）。
 * 使用场景：walk 追速；仍远低于日志4 的 gain×5 过冲。
 */
const WALK_MAX_DV_ACCEL = 0.045;
/** 刹车/超速纠正单 tick 上限 */
const WALK_MAX_DV_BRAKE = 0.08;
/**
 * 每隔几 tick 对 goal facingLocation（须 keepVelocity，否则会清速，见日志6）。
 * 使用场景：途中维持朝向；配合侧向抵消。
 */
const FACE_EVERY = 4;
/**
 * Jump1 查 Gap 桶：Δy=+1 → plannedDist=2, plannedDy=1。
 * 使用场景：hy 取桶；hx 用 FIT 反解，射程至少跨上台沿。
 */
const JUMP1_PLANNED_DIST = 2;
const JUMP1_PLANNED_DY = 1;
/** 起跳瞄准水平射程下限（格），避免贴墙时 actualH≈0.8 → hx 过小 */
const JUMP1_MIN_TARGET_H = 1.35;
/**
 * 距上台沿多远起跳（沿跑道，格）。日志4 在 0.9 处贴墙；略提前。
 * 使用场景：shouldJump。
 */
const JUMP_TRIGGER_BEFORE = 1.55;
/** 起跳要求沿跑道水平速带（巡航起来后再跳） */
const JUMP_ALONG_MIN = 0.08;
const JUMP_ALONG_MAX = 0.2;
/** 起跳后仍落在低台，允许再次起跳的间隔（tick） */
const JUMP_RETRY_AFTER = 12;
/** 单次用例最多 Gap 起跳次数（含重试） */
const JUMP_MAX_ATTEMPTS = 2;

type Cardinal = { dx: number; dz: number };
type CaseKind = "walk" | "jump1";

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
};

type Job = { caseKind: CaseKind; trial: number };

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
      /** Jump1 是否已施加起跳冲量 */
      jumped: boolean;
      /** 最近一次起跳时的 trackTicks；用于失败回落重试 */
      jumpedAt: number | undefined;
      /** 本用例已起跳次数 */
      jumpAttempts: number;
      phase: "spawn_wait" | "tracking" | "despawn_wait";
      phaseTicks: number;
      start: Vector3 | undefined;
      traj: Sample[];
      trackTicks: number;
      airTicks: number;
      peakVy: number;
      handle: number;
    };

/**
 * 冲量代理一键对比探针。
 * 使用场景：与 path_mov_run 同地形；验收 SUM 是否贴近 PATHMOV。
 */
export class MovementProxyTest {
  private state: ProxyState = { kind: "idle" };
  private lastResults: TrialResult[] = [];

  constructor() {
    testCommandRegister.register("path_proxy_help", (s) => this.help(s));
    testCommandRegister.register("path_proxy_run", (s, a) => this.run(s, a));
    testCommandRegister.register("path_proxy_stop", (s) => this.stop(s));
    testCommandRegister.register("path_proxy_dump", (s) => this.dump(s));
    Logger.info(TAG, "registered path_proxy_help/run/stop/dump");
  }

  private help(source: Entity): void {
    this.msg(
      source,
      [
        "冲量代理原型（对照 PATHMOV，PATHPROXY|）",
        "path_proxy_run — 默认 walk→jump1",
        "path_proxy_run walk|jump1|all [trials]",
        "path_proxy_stop / path_proxy_dump",
        `着地追速 ${TARGET_VXZ}（摩擦×${f3(WALK_FRICTION_CMD_SCALE)}，accel≤${WALK_MAX_DV_ACCEL}）`,
        "每 tick 抵消侧向；定期 facingLocation + keepVelocity",
        `Jump1=Gap(2,1) minH=${JUMP1_MIN_TARGET_H}；沿程速 ${JUMP_ALONG_MIN}~${JUMP_ALONG_MAX}`,
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
    };
    this.logData(
      `META,start,mode=impulse_proxy,cases=${parsed.cases.join("+")},trials=${parsed.trials},targetVxz=${TARGET_VXZ},frictionScale=${f3(WALK_FRICTION_CMD_SCALE)},maxDvAcc=${WALK_MAX_DV_ACCEL},latCancel=1,jump=gap:${JUMP1_PLANNED_DIST}:${JUMP1_PLANNED_DY},minH=${JUMP1_MIN_TARGET_H},pursue=off`
    );
    this.msg(
      source,
      `开始代理 jobs=${jobs.length} origin=${origin.x},${origin.y},${origin.z}`
    );
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
        this.emitSmpl(r.caseKind, r.trial, s);
      }
    }
    this.msg(source, `dump n=${results.length}（见 PATHPROXY|）`);
  }

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
      /* continue */
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
      // 只挂索敌，不挂追逐：避免原版 nav 抢位移
      if (!EntityMaid.Seek.mount(maid, seekId)) {
        this.msg(st.source, "Seek.mount 失败");
      }
    } catch (e) {
      this.msg(st.source, `Seek/marker 失败: ${String(e)}`);
    }

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
      `META,job,${st.jobIndex + 1}/${st.jobs.length},case=${job.caseKind},trial=${job.trial},goal=${f3(st.goalFeet.x)},${f3(st.goalFeet.y)},${f3(st.goalFeet.z)}`
    );
    this.msg(
      st.source,
      `job ${st.jobIndex + 1}/${st.jobs.length} ${job.caseKind}#${job.trial}`
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
      this.drive(st, maid, job.caseKind);
      this.sampleOnce(st, maid, st.trackTicks);

      let onGround = false;
      try {
        onGround = maid.isOnGround;
      } catch {
        onGround = false;
      }
      if (!onGround) {
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
   * 着地限幅追巡航；Jump1 在巡航速内 Gap 起跳；空中不补水平。
   * 使用场景：tracking 每 tick，采样前执行。
   */
  private drive(
    st: Extract<ProxyState, { kind: "running" }>,
    maid: Entity,
    caseKind: CaseKind
  ): void {
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
    // 侧向分量：控制器只推 cardinal，若不抵消会累积（日志5 t83 起 vx 变负偏离跑道）
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

    // 定期面朝目标；keepVelocity 避免默认 teleport 清速（日志6）
    if (st.trackTicks % FACE_EVERY === 0) {
      try {
        maid.teleport(loc, {
          facingLocation: { x: goal.x, y: goal.y, z: goal.z },
          keepVelocity: true,
        });
      } catch {
        /* ignore */
      }
    }

    if (hDist <= ARRIVE_H) {
      // 抵达附近仍消侧向，避免蹭出去
      if (Math.hypot(latX, latZ) > 1e-4) {
        try {
          maid.applyImpulse({ x: -latX, y: 0, z: -latZ });
        } catch {
          /* ignore */
        }
      }
      return;
    }
    // 指令速：摩擦放大后贴近 PATHMOV 0.135；近距按真实目标速比例减速
    let displayTarget = TARGET_VXZ;
    if (hDist < DECEL_H) {
      displayTarget =
        TARGET_VXZ * Math.max(0, (hDist - ARRIVE_H) / (DECEL_H - ARRIVE_H));
    }
    const cmdTarget = displayTarget * WALK_FRICTION_CMD_SCALE;
    let delta = cmdTarget - along;
    if (delta > WALK_MAX_DV_ACCEL) {
      delta = WALK_MAX_DV_ACCEL;
    } else if (delta < -WALK_MAX_DV_BRAKE) {
      delta = -WALK_MAX_DV_BRAKE;
    }
    // 合成：沿程修正 + 完全抵消侧向
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
   * Jump1：Gap 桶 hy + FIT 反解 hx（射程不低于 JUMP1_MIN_TARGET_H），clearVelocity 后一次冲量。
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
    const ref = lookupImpulse(JUMP1_PLANNED_DIST, JUMP1_PLANNED_DY);
    if (!dbg || !ref) {
      this.msg(st.source, "resolveImpulseEx 失败，跳过起跳");
      return;
    }
    const hy = dbg.vec.hy;
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
          `hyRaw=${f3(dbg.hyRaw)}`,
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
   * Jump1 起跳窗：低台、距沿合适、水平速在巡航带内。
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
    if (alongVel < JUMP_ALONG_MIN || alongVel > JUMP_ALONG_MAX) {
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
    const job = st.jobs[st.jobIndex];
    this.emitSmpl(job.caseKind, job.trial, s);
  }

  private emitSmpl(caseKind: CaseKind, trial: number, s: Sample): void {
    this.logData(
      `SMPL,${caseKind},${trial},${s.t},${f3(s.x)},${f3(s.y)},${f3(s.z)},${f3(s.vx)},${f3(s.vy)},${f3(s.vz)},${s.onGround ? 1 : 0},${f3(s.hDist)},${f3(s.yawApprox)}`
    );
  }

  private checkArrived(
    st: Extract<ProxyState, { kind: "running" }>,
    maid: Entity,
    caseKind: CaseKind,
    onGround: boolean
  ): string | undefined {
    const goal = st.goalFeet!;
    const loc = maid.location;
    const h = Math.hypot(loc.x - goal.x, loc.z - goal.z);
    const vOk = Math.abs(loc.y - goal.y) <= ARRIVE_V;
    if (caseKind === "jump1" && st.goalSupportY !== undefined) {
      if (loc.y < st.goalSupportY + 1 - 0.2) {
        return undefined;
      }
    }
    if (h <= ARRIVE_H && vOk && onGround) {
      return "near";
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
      `代理结束 reason=${reason} n=${st.results.length}；搜 PATHPROXY| 对照 PATHMOV|`
    );
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
