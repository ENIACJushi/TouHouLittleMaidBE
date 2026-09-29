import { Entity, system } from "@minecraft/server";
import { Logger } from "../../src/controller/Logger";
import { testCommandRegister } from "../TestCommandRegister";

const TAG = "SeekHateClearTest";
/** 探针实体标签：便于 status / cleanup 定位，勿与生产逻辑混用 */
const PROBE_TAG = "thlm_seek_hate_probe";
const FAIRY_TYPE = "touhou_little_maid:debug_fairy";
const TARGET_TYPE = "touhou_little_maid:debug_target_2";

/**
 * Task6 Phase 0：仇恨清除机制临时候选探针。
 * 使用场景：游戏内手动对比「卸 Seek / reset_target / 改 thlmt:value」三种清恨路径。
 * 命令：/scriptevent thlm:test seek_hate_<子命令>
 */
export class SeekHateClearTest {
  constructor() {
    testCommandRegister.register("seek_hate_help", (source) => this.help(source));
    testCommandRegister.register("seek_hate_setup", (source) => this.setup(source));
    testCommandRegister.register("seek_hate_status", (source) => this.status(source));
    testCommandRegister.register("seek_hate_sticky", (source) => this.mountSeek(source, "probe:seek_sticky"));
    testCommandRegister.register("seek_hate_reeval", (source) => this.mountSeek(source, "probe:seek_reeval"));
    testCommandRegister.register("seek_hate_quit", (source) => this.triggerFairy(source, "probe:seek_off"));
    testCommandRegister.register("seek_hate_reset", (source) => this.triggerFairy(source, "api:reset_target"));
    testCommandRegister.register("seek_hate_value_ok", (source) => this.setTargetValue(source, 9));
    testCommandRegister.register("seek_hate_value_bad", (source) => this.setTargetValue(source, -1));
    testCommandRegister.register("seek_hate_cleanup", (source) => this.cleanup(source));
    Logger.info(TAG, "registered seek_hate_* commands");
  }

  private help(source: Entity): void {
    this.msg(
      source,
      [
        "Task6 Phase0 仇恨清除探针",
        "seek_hate_setup — 生成妖精+目标(value=9)并挂 sticky 索敌",
        "seek_hate_status — 打印 fairy.target / 目标 value",
        "seek_hate_sticky | seek_hate_reeval — 切换索敌组",
        "seek_hate_quit — 卸掉索敌组件组",
        "seek_hate_reset — 仅 api:reset_target（保留索敌组）",
        "seek_hate_value_bad | seek_hate_value_ok — 目标 value=-1 / 9",
        "seek_hate_cleanup — 清除探针实体",
      ].join("\n")
    );
  }

  /**
   * 在玩家附近生成一对探针：妖精挂 sticky 索敌，目标 value=9。
   */
  private setup(source: Entity): void {
    this.cleanup(source);
    const dim = source.dimension;
    const base = source.location;
    const fairy = dim.spawnEntity(FAIRY_TYPE as any, {
      x: base.x + 1.5,
      y: base.y,
      z: base.z,
    });
    const target = dim.spawnEntity(TARGET_TYPE as any, {
      x: base.x + 4.5,
      y: base.y + 0.2,
      z: base.z,
    });
    fairy.addTag(PROBE_TAG);
    target.addTag(PROBE_TAG);
    target.setProperty("thlmt:value", 9);
    fairy.triggerEvent("probe:seek_sticky");
    this.msg(source, "setup ok: sticky seek + target value=9；约 1s 后执行 seek_hate_status");
    system.runTimeout(() => this.status(source), 20);
  }

  private status(source: Entity): void {
    const fairy = this.findProbe(source, FAIRY_TYPE);
    const target = this.findProbe(source, TARGET_TYPE);
    if (!fairy) {
      this.msg(source, "status: 未找到探针妖精，先 seek_hate_setup");
      return;
    }
    let hate = "undefined";
    try {
      const t = fairy.target;
      hate = t ? `${t.typeId} @ ${fmt(t.location)}` : "undefined";
    } catch (e) {
      hate = `error:${String(e)}`;
    }
    const value =
      target !== undefined ? String(target.getProperty("thlmt:value")) : "no-target-entity";
    this.msg(
      source,
      `status:\nfairy=${fmt(fairy.location)}\nhate=${hate}\ntarget.value=${value}`
    );
    Logger.info(TAG, `hate=${hate} value=${value}`);
  }

  private mountSeek(source: Entity, event: string): void {
    this.triggerFairy(source, event);
    system.runTimeout(() => this.status(source), 20);
  }

  private triggerFairy(source: Entity, event: string): void {
    const fairy = this.findProbe(source, FAIRY_TYPE);
    if (!fairy) {
      this.msg(source, `fail: 无探针妖精 (${event})`);
      return;
    }
    fairy.triggerEvent(event);
    this.msg(source, `triggered ${event}；建议 1~3s 后再 status`);
  }

  private setTargetValue(source: Entity, value: number): void {
    const target = this.findProbe(source, TARGET_TYPE);
    if (!target) {
      this.msg(source, "fail: 无探针目标");
      return;
    }
    target.setProperty("thlmt:value", value);
    this.msg(source, `target thlmt:value=${value}；建议立即与数秒后各 status 一次`);
    system.runTimeout(() => this.status(source), 5);
    system.runTimeout(() => this.status(source), 40);
  }

  private cleanup(source: Entity): void {
    const dim = source.dimension;
    const list = dim.getEntities({
      location: source.location,
      maxDistance: 48,
      tags: [PROBE_TAG],
    });
    for (const e of list) {
      try {
        e.remove();
      } catch {
        /* ignore */
      }
    }
    this.msg(source, `cleanup: removed ${list.length}`);
  }

  private findProbe(source: Entity, typeId: string): Entity | undefined {
    return source.dimension.getEntities({
      location: source.location,
      maxDistance: 48,
      type: typeId,
      tags: [PROBE_TAG],
    })[0];
  }

  /**
   * 向执行者回显；不用 instanceof Player（跨模块常假阴性，导致聊天无输出）。
   * 使用场景：seek_hate_* 探针命令的玩家可见反馈。
   */
  private msg(source: Entity, text: string): void {
    const line = `[${TAG}] ${text}`;
    // Bedrock：优先 duck-type sendMessage；回退 typeId 判断
    const anySrc = source as Entity & { sendMessage?: (m: string) => void };
    if (typeof anySrc.sendMessage === "function") {
      anySrc.sendMessage(line);
    } else if (source.typeId === "minecraft:player") {
      Logger.warn(TAG, `player without sendMessage: ${text}`);
    }
    Logger.info(TAG, text);
  }
}

function fmt(loc: { x: number; y: number; z: number }): string {
  return `${loc.x.toFixed(1)},${loc.y.toFixed(1)},${loc.z.toFixed(1)}`;
}
