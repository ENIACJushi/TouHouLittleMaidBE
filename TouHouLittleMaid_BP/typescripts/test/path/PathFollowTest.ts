/**
 * Task7 Phase2：Path.follow 冒烟验收（永久保留，后续回归继续用）。
 * 使用场景：`/scriptevent thlm:test path_go|path_cancel|path_status|path_help`。
 * path_go 会打 PATHGO| 规划摘要与 PATHDONE| 完成回调；Gap 见 PATHGAP|（Executor）。
 * 抵达：途经用距离；终点近战命中 seek_marker → Done。
 */
import {Entity, Player, system, world} from "@minecraft/server";
import { Logger } from "../../src/controller/Logger";
import { EntityMaid } from "../../src/maid/EntityMaid";
import {
  debugPumpStandField,
  listChunkFieldNodes,
  peekStandField,
} from "../../src/maid/path/field/StandField";
import { testCommandRegister } from "../TestCommandRegister";

const TAG = "PathFollow";
const MAID_TYPE = "thlmm:maid";
/** path_go 规划诊断前缀（纯 console） */
const GO_LOG = "PATHGO";
/** Path.onComplete 诊断前缀 */
const DONE_LOG = "PATHDONE";

/**
 * follow 冒烟：看向方块为终点，找最近女仆执行 Path.follow。
 */
export class PathFollowTest {
  constructor() {
    testCommandRegister.register("path_help", (s) => this.help(s));
    testCommandRegister.register("path_go", (s) => this.go(s));
    testCommandRegister.register("path_cancel", (s) => this.cancel(s));
    testCommandRegister.register("path_status", (s) => this.status(s));
    testCommandRegister.register("path_field", (s) => this.field(s));
    Logger.info(TAG, "registered path_go/cancel/status");
  }

  private help(source: Entity): void {
    this.msg(
      source,
      [
        "Task7 Phase2 follow 冒烟",
        "path_go — 最近女仆 → 看向方块；控制台搜 PATHGO| / PATHDONE| / PATHGAP|",
        "path_cancel — 取消最近女仆的 follow",
        "path_status — 是否 isFollowing + Seek 档",
        "path_field — 看向的方块所在区块，按落脚点表建场并打粒子",
        "抵达：途经=距离；终点=近战命中 seek_marker → PATHDONE",
        "建议：先平地 Walk，再含 SprintGap 的沟",
        "可视化：显示路点=红/绿路点+青绿可认领+黄(还不能认领)+品红ban；另有轨迹开关",
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
    const t0 = Date.now();
    system.runTimeout(() => {
      if (!maid.isValid) {
        this.msg(source, "path_go: 女仆已失效");
        return;
      }
      const result = EntityMaid.Path.follow(maid, dest, {
        onComplete: (info) => {
          const dt = Date.now() - t0;
          console.log(
            [
              `${DONE_LOG}|COMPLETE`,
              `reason=${info.reason}`,
              `detail=${info.detail}`,
              `maidId=${info.maidId}`,
              `dest=${info.dest.x},${info.dest.y},${info.dest.z}`,
              `dtMs=${dt}`,
            ].join(",")
          );
          this.msg(
            source,
            `PATHDONE reason=${info.reason} detail=${info.detail} dt=${dt}ms`
          );
        },
      });
      const edgeKinds =
        result.edges.map((e) => e.kind).join(">") || "(none)";
      this.msg(
        source,
        [
          `go maid=${maid.id.slice(0, 8)}… dest=${block.typeId}`,
          `plan ok=${result.ok} reason=${result.reason ?? "-"} edges=${edgeKinds}`,
          result.ok
            ? "已启动；走到终点近战后应见 PATHDONE reason=done"
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

  /**
   * 看向方块所在区块，按拍预算连建若干拍，并在落脚点上打粒子。
   * 青绿：场牌可认领。品红：这一拍还不能认领。
   */
  private field(source: Entity): void {
    const block = this.lookBlock(source);
    if (!block) {
      this.msg(source, "path_field: 请看向方块");
      return;
    }
    const pos = block.location;
    debugPumpStandField(source.dimension, pos.x, pos.y, pos.z, 40);
    const nodes = listChunkFieldNodes(source.dimension, pos.x, pos.z);
    let claimable = 0;
    for (const node of nodes) {
      const particle = node.claimable
        ? "touhou_little_maid:path_reach_field"
        : "touhou_little_maid:path_unreachable";
      try {
        source.dimension.spawnParticle(particle as never, {
          x: node.x + 0.5,
          y: node.y + 1.05,
          z: node.z + 0.5,
        });
      } catch {
        /* 粒子未加载时仍保留下面的文字 */
      }
      if (node.claimable) {
        claimable += 1;
      }
    }
    const here = peekStandField(source.dimension, pos.x, pos.y, pos.z);
    const at = peekStandField(source.dimension, pos.x, pos.y - 1, pos.z);
    const shown = here ?? at;
    this.msg(
      source,
      [
        `落脚点 ${nodes.length}，可认领 ${claimable}`,
        shown
          ? `看向 ${shown.x},${shown.y},${shown.z} 场 ${shown.fieldId} ${shown.claimable ? "可认领" : "暂停"} 邻居 ${shown.steps.length}`
          : "看向的这一格还没有落脚点",
      ].join("\n")
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
