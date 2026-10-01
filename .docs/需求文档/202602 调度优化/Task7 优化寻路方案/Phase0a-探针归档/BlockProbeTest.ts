import {
  Block,
  BlockPermutation,
  Entity,
  Player,
  system,
  Vector3,
} from "@minecraft/server";
import { Logger } from "../../src/controller/Logger";
import { StandableCache } from "../../src/maid/path/StandableCache";
import { testCommandRegister } from "../TestCommandRegister";

const TAG = "BlockProbe";
/** 矩阵样本标记，便于 cleanup */
const MATRIX_TAG = "thlm_block_probe_matrix";

/**
 * 矩阵一样本。
 * 使用场景：block_probe_matrix 用 BlockPermutation 铺走廊（避免 setblock 状态串语法坑）。
 */
type Sample = {
  label: string;
  typeId: string;
  /** 可选方块状态（Bedrock 名，如 open_bit） */
  states?: Record<string, boolean | number | string>;
  category: "support" | "pass" | "nav_mismatch" | "hazard";
};

/**
 * Task7 Phase0a：可站立 / 可穿过 / NavMismatch 探针。
 * 使用场景：`/scriptevent thlm:test block_probe_*`；测完归档。
 */
export class BlockProbeTest {
  constructor() {
    testCommandRegister.register("block_probe_help", (s) => this.help(s));
    testCommandRegister.register("block_probe_api", (s) => this.api(s));
    testCommandRegister.register("block_probe_dump", (s) => this.dump(s));
    testCommandRegister.register("block_probe_matrix", (s) => this.matrix(s));
    testCommandRegister.register("block_probe_cleanup", (s) => this.cleanup(s));
    Logger.info(TAG, "registered block_probe_* commands");
  }

  private help(source: Entity): void {
    this.msg(
      source,
      [
        "Task7 Phase0a 方块判定探针",
        "block_probe_api — 探测 Block.isSolid / isLiquid 等",
        "block_probe_dump — 看向/脚下：API + P*/S* 候选",
        "block_probe_matrix — 脚前铺样本（Permutation API；活板门/水火隔离）",
        "block_probe_cleanup — 清标记盔甲架",
        "注意：本环境 isSolid≠完整碰撞（玻璃 isSolid=false 仍可站）",
      ].join("\n")
    );
  }

  private api(source: Entity): void {
    const block = source.dimension.getBlock(this.belowFeetLoc(source.location));
    if (!block) {
      this.msg(source, "api: 脚下无方块");
      return;
    }
    const keys = ["isAir", "isSolid", "isLiquid", "isWaterlogged", "typeId", "permutation"];
    const lines: string[] = [`api capability @ ${block.typeId}:`];
    for (const k of keys) {
      const v = (block as unknown as Record<string, unknown>)[k];
      const t = typeof v;
      lines.push(`  ${k}: ${t}${t === "boolean" ? "=" + v : ""}`);
    }
    try {
      const tags = block.permutation?.getTags?.() ?? [];
      lines.push(`  getTags(): [${tags.slice(0, 12).join(", ")}]`);
    } catch (e) {
      lines.push(`  getTags error: ${String(e)}`);
    }
    this.msg(source, lines.join("\n"));
  }

  private dump(source: Entity): void {
    const block = this.resolveTargetBlock(source);
    if (!block) {
      this.msg(source, "dump: 无目标方块");
      return;
    }
    this.msg(source, this.formatDump(block));
  }

  private matrix(source: Entity): void {
    this.cleanup(source);
    const dim = source.dimension;
    const base = this.belowFeetLoc(source.location);
    const samples = this.sampleList();
    const facing = this.horizontalFacing(source);
    this.msg(
      source,
      `matrix: 铺 ${samples.length} 格 @ facing=(${facing.x},${facing.z})；底座 y=${base.y}`
    );

    system.run(() => {
      const lines: string[] = ["matrix dump:"];
      // 样本间距 2，避免水+熔岩邻接变成黑曜石
      const step = 2;
      for (let i = 0; i < samples.length; i++) {
        const s = samples[i];
        const x = base.x + facing.x * (2 + i * step);
        const y = base.y;
        const z = base.z + facing.z * (2 + i * step);
        try {
          this.placeSample(dim, { x, y, z }, s);
        } catch (e) {
          lines.push(`#${i} ${s.label} place fail: ${String(e)}`);
          continue;
        }
        const block = dim.getBlock({ x, y, z });
        if (!block) {
          lines.push(`#${i} ${s.label} missing after place`);
          continue;
        }
        lines.push(
          `#${i} [${s.category}] ${s.label} @${x},${y},${z}\n` + this.formatDump(block)
        );
      }
      try {
        const mark = dim.spawnEntity("minecraft:armor_stand" as any, {
          x: base.x + facing.x * 2 + 0.5,
          y: base.y + 1,
          z: base.z + facing.z * 2 + 0.5,
        });
        mark.addTag(MATRIX_TAG);
        mark.nameTag = "block_probe_matrix";
      } catch {
        /* ignore */
      }
      this.msg(source, lines.join("\n---\n"));
    });
  }

  /**
   * 用 Script API 铺底座+样本+净空，避免 setblock 状态语法错误。
   */
  private placeSample(
    dim: Entity["dimension"],
    at: Vector3,
    s: Sample
  ): void {
    const below = dim.getBlock({ x: at.x, y: at.y - 1, z: at.z });
    const cell = dim.getBlock(at);
    const above = dim.getBlock({ x: at.x, y: at.y + 1, z: at.z });
    const above2 = dim.getBlock({ x: at.x, y: at.y + 2, z: at.z });
    if (!below || !cell) {
      throw new Error("getBlock undefined");
    }
    below.setPermutation(BlockPermutation.resolve("minecraft:stone"));
    if (above) above.setPermutation(BlockPermutation.resolve("minecraft:air"));
    if (above2) above2.setPermutation(BlockPermutation.resolve("minecraft:air"));

    let perm: BlockPermutation;
    try {
      perm = s.states
        ? BlockPermutation.resolve(s.typeId, s.states)
        : BlockPermutation.resolve(s.typeId);
    } catch (e) {
      // 活板门等状态名因版本而异：无状态先放默认，再尝试 withState
      perm = BlockPermutation.resolve(s.typeId);
      if (s.states) {
        for (const k of Object.keys(s.states)) {
          try {
            perm = perm.withState(k as never, s.states[k] as never);
          } catch {
            /* 跳过未知 state */
          }
        }
      }
    }
    cell.setPermutation(perm);
  }

  private cleanup(source: Entity): void {
    const stands = source.dimension.getEntities({
      location: source.location,
      maxDistance: 64,
      type: "minecraft:armor_stand",
      tags: [MATRIX_TAG],
    });
    for (const e of stands) {
      try {
        e.remove();
      } catch {
        /* ignore */
      }
    }
    this.msg(source, `cleanup: removed ${stands.length} markers`);
  }

  private sampleList(): Sample[] {
    return [
      { label: "stone", typeId: "minecraft:stone", category: "support" },
      { label: "glass", typeId: "minecraft:glass", category: "support" },
      { label: "oak_leaves", typeId: "minecraft:oak_leaves", category: "support" },
      { label: "oak_fence", typeId: "minecraft:oak_fence", category: "support" },
      { label: "white_carpet", typeId: "minecraft:white_carpet", category: "pass" },
      { label: "short_grass", typeId: "minecraft:short_grass", category: "pass" },
      { label: "dandelion", typeId: "minecraft:dandelion", category: "pass" },
      { label: "torch", typeId: "minecraft:torch", category: "pass" },
      { label: "water", typeId: "minecraft:water", category: "hazard" },
      // 与 water 已用 step=2 隔开；仍避免紧挨
      { label: "lava", typeId: "minecraft:lava", category: "hazard" },
      {
        label: "trapdoor_closed_bottom",
        // 本环境 BlockPermutation 不认 oak_trapdoor，用通用 trapdoor + wood_type
        typeId: "minecraft:trapdoor",
        states: { open_bit: false, upside_down_bit: false, wood_type: "oak" },
        category: "nav_mismatch",
      },
      {
        label: "trapdoor_open_bottom",
        typeId: "minecraft:trapdoor",
        states: { open_bit: true, upside_down_bit: false, wood_type: "oak" },
        category: "nav_mismatch",
      },
      {
        label: "trapdoor_closed_top",
        typeId: "minecraft:trapdoor",
        states: { open_bit: false, upside_down_bit: true, wood_type: "oak" },
        category: "nav_mismatch",
      },
      {
        label: "iron_trapdoor_closed",
        typeId: "minecraft:iron_trapdoor",
        states: { open_bit: false, upside_down_bit: false },
        category: "nav_mismatch",
      },
      {
        label: "ladder",
        typeId: "minecraft:ladder",
        states: { facing_direction: 2 },
        category: "nav_mismatch",
      },
      { label: "scaffolding", typeId: "minecraft:scaffolding", category: "nav_mismatch" },
      {
        label: "stone_pressure_plate",
        typeId: "minecraft:stone_pressure_plate",
        category: "nav_mismatch",
      },
    ];
  }

  private formatDump(block: Block): string {
    const isAir = !!block.isAir;
    const isSolid = this.readBool(block, "isSolid");
    const isLiquid = this.readBool(block, "isLiquid");
    let tags: string[] = [];
    let states: string = "";
    try {
      tags = block.permutation?.getTags?.() ?? [];
      const all = block.permutation?.getAllStates?.() ?? {};
      states = JSON.stringify(all);
    } catch {
      /* ignore */
    }
    const P0 = isAir;
    const P1 = isSolid === undefined ? undefined : !isSolid;
    const P2 = isAir || isLiquid === true;
    const S0 = isSolid;
    const S1 = !isAir && isLiquid !== true;
    const hazardGuess =
      block.typeId.includes("lava") ||
      block.typeId.includes("fire") ||
      block.typeId === "minecraft:water";

    // 锁定公式对照（§6.2 → StandableCache）
    const locked = StandableCache.evalBlock(block);

    return [
      `typeId=${block.typeId}`,
      `isAir=${isAir} isSolid=${fmtOpt(isSolid)} isLiquid=${fmtOpt(isLiquid)}`,
      `states=${states}`,
      `tags=[${tags.slice(0, 8).join(",")}]`,
      `P0(isAir)=${P0} P1(!solid)=${fmtOpt(P1)} P2(air|liq)=${P2}`,
      `S0(solid)=${fmtOpt(S0)} S1(!air&!liq)=${S1}`,
      `hazardGuess=${hazardGuess}`,
      `LOCKED pass=${locked.passable} support=${locked.support} hazard=${locked.hazard} mismatch=${locked.navMismatch}`,
    ].join("\n");
  }

  private readBool(block: Block, key: string): boolean | undefined {
    const v = (block as unknown as Record<string, unknown>)[key];
    return typeof v === "boolean" ? v : undefined;
  }

  private resolveTargetBlock(source: Entity): Block | undefined {
    if (source instanceof Player || source.typeId === "minecraft:player") {
      try {
        const hit = (source as Player).getBlockFromViewDirection({ maxDistance: 8 });
        if (hit?.block) return hit.block;
      } catch {
        /* fall through */
      }
    }
    return source.dimension.getBlock(this.belowFeetLoc(source.location));
  }

  /** 脚下支撑格（玩家脚位置下一格） */
  private belowFeetLoc(loc: Vector3): Vector3 {
    return {
      x: Math.floor(loc.x),
      y: Math.floor(loc.y) - 1,
      z: Math.floor(loc.z),
    };
  }

  private horizontalFacing(source: Entity): { x: number; z: number } {
    try {
      const v = source.getViewDirection();
      if (Math.abs(v.x) >= Math.abs(v.z)) {
        return { x: v.x >= 0 ? 1 : -1, z: 0 };
      }
      return { x: 0, z: v.z >= 0 ? 1 : -1 };
    } catch {
      return { x: 1, z: 0 };
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

function fmtOpt(v: boolean | undefined): string {
  return v === undefined ? "N/A" : String(v);
}
