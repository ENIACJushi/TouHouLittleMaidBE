/**
 * Task7 Phase2：Path.follow 冒烟验收（永久保留，后续回归继续用）。
 * 使用场景：`/scriptevent thlm:test path_go|path_cancel|path_status`。
 * path_go 会打 PATHGO| 规划摘要；Gap 冲量/落地见 PATHGAP|（Executor）。
 */
import { Entity, Player, system } from "@minecraft/server";
import { Logger } from "../../src/controller/Logger";
import { EntityMaid } from "../../src/maid/EntityMaid";
import { testCommandRegister } from "../TestCommandRegister";

const TAG = "PathFollow";
const MAID_TYPE = "thlmm:maid";
/** path_go 规划诊断前缀（纯 console） */
const GO_LOG = "PATHGO";

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
        "path_go — 最近女仆 → 看向方块；控制台搜 PATHGO| / PATHGAP|",
        "path_cancel — 取消最近女仆的 follow",
        "path_status — 是否 isFollowing + Seek 档",
        "建议：先平地 Walk，再含 SprintGap 的沟",
        "可视化：管理界面可开关「显示路点」「显示寻路轨迹」",
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
    const startSnap = { ...maid.location };
    system.runTimeout(() => {
      if (!maid.isValid) {
        this.msg(source, "path_go: 女仆已失效");
        return;
      }
      const result = EntityMaid.Path.follow(maid, dest);
      const edgeKinds =
        result.edges.map((e) => e.kind).join(">") || "(none)";
      this.msg(
        source,
        [
          `go maid=${maid.id.slice(0, 8)}… dest=${block.typeId}`,
          `plan ok=${result.ok} reason=${result.reason ?? "-"} edges=${edgeKinds}`,
          result.ok
            ? "已启动；抓取 PATHGO|PLAN/EDGE 与 PATHGAP|IMPULSE/LAND"
            : "FAIL 未启动",
        ].join("\n")
      );
      console.log(
        [
          `${GO_LOG}|PLAN`,
          `ok=${result.ok}`,
          `reason=${result.reason ?? "-"}`,
          `maidId=${maid.id}`,
          `start=${f3(startSnap.x)},${f3(startSnap.y)},${f3(startSnap.z)}`,
          `destBlock=${dest.x},${dest.y},${dest.z}`,
          `edges=${result.edges.length}`,
          `nodes=${result.nodes.length}`,
        ].join(",")
      );
      for (let i = 0; i < result.edges.length; i++) {
        const e = result.edges[i];
        const fromFeet = {
          x: e.from.x + 0.5,
          y: e.from.y + 1,
          z: e.from.z + 0.5,
        };
        const toFeet = {
          x: e.to.x + 0.5,
          y: e.to.y + 1,
          z: e.to.z + 0.5,
        };
        const h = Math.hypot(toFeet.x - fromFeet.x, toFeet.z - fromFeet.z);
        console.log(
          [
            `${GO_LOG}|EDGE`,
            `i=${i}`,
            `kind=${e.kind}`,
            `from=${e.from.x},${e.from.y},${e.from.z}`,
            `to=${e.to.x},${e.to.y},${e.to.z}`,
            `fromFeet=${f3(fromFeet.x)},${f3(fromFeet.y)},${f3(fromFeet.z)}`,
            `toFeet=${f3(toFeet.x)},${f3(toFeet.y)},${f3(toFeet.z)}`,
            `h=${f3(h)}`,
            `dy=${e.to.y - e.from.y}`,
          ].join(",")
        );
      }
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

function f3(n: number): string {
  return n.toFixed(3);
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
