/**
 * Task7 Phase2：Path.follow 冒烟验收（永久保留，后续回归继续用）。
 * 使用场景：`/scriptevent thlm:test path_go|path_cancel|path_status`。
 */
import { Entity, Player, system } from "@minecraft/server";
import { Logger } from "../../src/controller/Logger";
import { EntityMaid } from "../../src/maid/EntityMaid";
import { testCommandRegister } from "../TestCommandRegister";

const TAG = "PathFollow";
const MAID_TYPE = "thlmm:maid";

/**
 * follow 冒烟：看向方块为终点，找最近女仆执行 Path.follow。
 */
export class PathFollowTest {
  constructor() {
    testCommandRegister.register("path_help", (s) => this.help(s));
    testCommandRegister.register("path_go", (s) => this.go(s));
    testCommandRegister.register("path_cancel", (s) => this.cancel(s));
    testCommandRegister.register("path_status", (s) => this.status(s));
    Logger.info(TAG, "registered path_go/cancel/status");
  }

  private help(source: Entity): void {
    this.msg(
      source,
      [
        "Task7 Phase2 follow 冒烟",
        "path_go — 最近女仆 → 看向方块（须先看准目标格）",
        "path_cancel — 取消最近女仆的 follow",
        "path_status — 是否 isFollowing + Seek 档",
        "建议：先平地 Walk；Gap 冲量为占位，可能跳不准",
      ].join("\n")
    );
  }

  private go(source: Entity): void {
    const maid = this.nearestMaid(source);
    if (!maid) {
      this.msg(source, "path_go: 附近无女仆");
      return;
    }
    const block = this.lookBlock(source);
    if (!block) {
      this.msg(source, "path_go: 请看向目标方块（支撑面）");
      return;
    }
    EntityMaid.Init.maid(maid);
    EntityMaid.Work.set(maid, EntityMaid.Work.idle);
    EntityMaid.Movement.unlock(maid);
    const dest = block.location;
    system.runTimeout(() => {
      if (!maid.isValid) {
        this.msg(source, "path_go: 女仆已失效");
        return;
      }
      const result = EntityMaid.Path.follow(maid, dest);
      this.msg(
        source,
        [
          `go maid=${maid.id.slice(0, 8)}… dest=${block.typeId}`,
          `plan ok=${result.ok} reason=${result.reason ?? "-"} edges=${result.edges.map((e) => e.kind).join(">") || "(none)"}`,
          result.ok ? "已启动 follow，观察女仆移动" : "FAIL 未启动",
        ].join("\n")
      );
    }, 8);
  }

  private cancel(source: Entity): void {
    const maid = this.nearestMaid(source);
    if (!maid) {
      this.msg(source, "path_cancel: 附近无女仆");
      return;
    }
    EntityMaid.Path.cancel(maid);
    this.msg(source, "cancel ok");
  }

  private status(source: Entity): void {
    const maid = this.nearestMaid(source);
    if (!maid) {
      this.msg(source, "path_status: 附近无女仆");
      return;
    }
    this.msg(
      source,
      `following=${EntityMaid.Path.isFollowing(maid)} seek=${EntityMaid.Seek.getIndex(maid)}`
    );
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

  private lookBlock(source: Entity) {
    if (!(source instanceof Player) && source.typeId !== "minecraft:player") {
      return undefined;
    }
    try {
      return (source as Player).getBlockFromViewDirection({ maxDistance: 24 })
        ?.block;
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

function dist2(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number }
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}
