import { Entity, system } from "@minecraft/server";
import { Logger } from "../../src/controller/Logger";
import { EntityMaid } from "../../src/maid/EntityMaid";
import { testCommandRegister } from "../TestCommandRegister";

const TAG = "SeekTest";
/** 验收探针标签，便于 cleanup */
const PROBE_TAG = "thlm_seek_accept";
const MAID_TYPE = "thlmm:maid";

/**
 * Task6 Phase 2：Seek 门面双女仆独占验收。
 * 使用场景：`/scriptevent thlm:test seek_help|seek_setup|…`（不依赖 TEST 开关）。
 *
 * 注意：女仆基础 `hurt_by_target` 无过滤，两只贴太近会互锁仇恨盖过 Seek；
 * setup 将 B 拉远，避免干扰 A→marker 的独占判定。
 */
export class SeekTest {
  constructor() {
    testCommandRegister.register("seek_help", (s) => this.help(s));
    testCommandRegister.register("seek_setup", (s) => this.setup(s));
    testCommandRegister.register("seek_status", (s) => this.status(s));
    testCommandRegister.register("seek_release", (s) => this.release(s));
    testCommandRegister.register("seek_quit", (s) => this.quitAll(s));
    testCommandRegister.register("seek_cleanup", (s) => this.cleanup(s));
    Logger.info(TAG, "registered seek_* accept commands");
  }

  private help(source: Entity): void {
    this.msg(
      source,
      [
        "Task6 Phase2 Seek 验收",
        "seek_setup — 2 女仆(拉开) + marker；仅 A stamp，期望 A 恨 marker、B 无恨",
        "seek_status — 打印 A/B.target 与 marker.value + PASS/FAIL",
        "seek_release — release(marker) 后自动 status",
        "seek_quit — 两女仆 quit+free 后 status",
        "seek_cleanup — 清除探针实体并 free 池",
      ].join("\n")
    );
  }

  /**
   * 双女仆独占：仅 A 的 seekId 盖在 marker 上，期望只有 A 产生对 marker 的仇恨。
   */
  private setup(source: Entity): void {
    this.cleanup(source);
    const dim = source.dimension;
    const base = source.location;

    // A 与 marker 靠近；B 拉远，避免 hurt_by_target 互锁盖过 Seek
    const maidA = dim.spawnEntity(MAID_TYPE as any, {
      x: base.x + 2,
      y: base.y,
      z: base.z,
    });
    const maidB = dim.spawnEntity(MAID_TYPE as any, {
      x: base.x + 2,
      y: base.y,
      z: base.z + 16,
    });
    const marker = dim.spawnEntity(EntityMaid.Seek.MARKER_TYPE as any, {
      x: base.x + 4.5,
      y: base.y + 0.2,
      z: base.z,
    });
    for (const e of [maidA, maidB, marker]) {
      e.addTag(PROBE_TAG);
    }

    // 显式初始化（不依赖 JSON 触发时序）
    EntityMaid.Init.maid(maidA);
    EntityMaid.Init.maid(maidB);
    EntityMaid.Work.set(maidA, EntityMaid.Work.idle);
    EntityMaid.Work.set(maidB, EntityMaid.Work.idle);

    // 等 become_maid 组件组落地后再挂 Seek
    system.runTimeout(() => {
      if (!maidA.isValid || !maidB.isValid || !marker.isValid) {
        this.msg(source, "setup fail: 实体已失效");
        return;
      }
      const idA = EntityMaid.Seek.allocate();
      const idB = EntityMaid.Seek.allocate();
      if (idA === undefined || idB === undefined) {
        this.msg(source, "setup fail: allocate 耗尽");
        return;
      }
      EntityMaid.Seek.mount(maidA, idA);
      EntityMaid.Seek.mount(maidB, idB);
      EntityMaid.Seek.stamp(marker, idA);
      this.msg(
        source,
        `setup ok: A.seek=${idA} B.seek=${idB} marker.stamp=${idA}；B 已置于约 +16z；约 1.5s 后 status`
      );
      system.runTimeout(() => this.status(source), 30);
    }, 5);
  }

  private status(source: Entity): void {
    const maids = this.findTaggedMaids(source);
    const marker = this.findProbes(source, EntityMaid.Seek.MARKER_TYPE)[0];
    if (maids.length < 2 || !marker) {
      this.msg(source, "status: 探针不足，先 seek_setup");
      return;
    }
    // 按 seekId 识别 A/B（A=stamp 同档，B=另一档），避免 getEntities 顺序乱
    const stamp = EntityMaid.Seek.getStamp(marker) ?? EntityMaid.Seek.UNCLAIMED;
    const maidA = maids.find((m) => EntityMaid.Seek.getIndex(m) === stamp);
    const maidB = maids.find((m) => m !== maidA);
    if (!maidA || !maidB) {
      this.msg(
        source,
        `status: 无法按 stamp=${stamp} 区分 A/B；indexes=${maids
          .map((m) => EntityMaid.Seek.getIndex(m))
          .join(",")}`
      );
      return;
    }

    const hateA = this.hateDesc(maidA);
    const hateB = this.hateDesc(maidB);
    const aOk = hateA === EntityMaid.Seek.MARKER_TYPE;
    const bOk = hateB === "undefined";
    const verdict = aOk && bOk ? "PASS" : "FAIL";

    this.msg(
      source,
      [
        `status [${verdict}]:`,
        `A: seek=${EntityMaid.Seek.getIndex(maidA)} hate=${hateA}`,
        `B: seek=${EntityMaid.Seek.getIndex(maidB)} hate=${hateB}`,
        `marker.value=${stamp}`,
        `pool.allocated=${EntityMaid.Seek.allocatedCount()}`,
        aOk ? "A→marker OK" : "A 应恨 thlmt:seek_marker（若恨 thlmm:maid=互殴干扰）",
        bOk ? "B 无恨 OK" : "B 应无恨（异档不应锁 stamp）",
      ].join("\n")
    );
  }

  private release(source: Entity): void {
    const marker = this.findProbes(source, EntityMaid.Seek.MARKER_TYPE)[0];
    if (!marker) {
      this.msg(source, "release: 无 marker");
      return;
    }
    EntityMaid.Seek.release(marker);
    this.msg(source, "released marker.value=-1；约 0.25s/2s 后 status（reeval 应丢恨）");
    system.runTimeout(() => this.status(source), 5);
    system.runTimeout(() => this.status(source), 40);
  }

  private quitAll(source: Entity): void {
    const maids = this.findTaggedMaids(source);
    for (const maid of maids) {
      if (!maid.isValid) continue;
      const id = EntityMaid.Seek.getIndex(maid);
      EntityMaid.Seek.quit(maid);
      if (id >= 0) {
        EntityMaid.Seek.free(id);
      }
    }
    this.msg(source, `quit+free ${maids.length} maids；约 0.5s 后 status`);
    system.runTimeout(() => this.status(source), 10);
  }

  private cleanup(source: Entity): void {
    const list = source.dimension.getEntities({
      location: source.location,
      maxDistance: 64,
      tags: [PROBE_TAG],
    });
    for (const e of list) {
      if (e.typeId === MAID_TYPE && e.isValid) {
        const id = EntityMaid.Seek.getIndex(e);
        try {
          EntityMaid.Seek.quit(e);
        } catch {
          /* ignore */
        }
        if (id >= 0) {
          EntityMaid.Seek.free(id);
        }
      }
      try {
        if (e.isValid) e.remove();
      } catch {
        /* ignore */
      }
    }
    this.msg(source, `cleanup: removed ${list.length}`);
  }

  private findProbes(source: Entity, typeId: string): Entity[] {
    return source.dimension.getEntities({
      location: source.location,
      maxDistance: 64,
      type: typeId,
      tags: [PROBE_TAG],
    });
  }

  private findTaggedMaids(source: Entity): Entity[] {
    return this.findProbes(source, MAID_TYPE).filter((e) => e.isValid);
  }

  private hateDesc(maid: Entity): string {
    try {
      const t = maid.target;
      return t ? t.typeId : "undefined";
    } catch (e) {
      return `error:${String(e)}`;
    }
  }

  /**
   * 向执行者回显；duck-type sendMessage（避免 instanceof Player 假阴性）。
   */
  private msg(source: Entity, text: string): void {
    const line = `[${TAG}] ${text}`;
    const anySrc = source as Entity & { sendMessage?: (m: string) => void };
    if (typeof anySrc.sendMessage === "function") {
      anySrc.sendMessage(line);
    }
    Logger.info(TAG, text);
  }
}
