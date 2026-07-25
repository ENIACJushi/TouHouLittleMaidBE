/**
 * 将 BP / RP / PBR 同步到 Minecraft 开发目录
 *
 * 目标：
 *   %MinecraftPath%\development_behavior_packs\TouHouLittleMaid_BP
 *   %MinecraftPath%\development_resource_packs\TouHouLittleMaid_RP
 *   %MinecraftPath%\development_resource_packs\TouHouLittleMaid_PBR
 */
import path from "node:path";
import {
  BP_ROOT,
  PBR_ROOT,
  RP_ROOT,
  copyPackFiltered,
  resolveMinecraftPath,
} from "./common.js";

/**
 * @param {string} label
 * @param {string} source
 * @param {string} target
 */
function deployOne(label, source, target) {
  console.log(`[deploy] ${label}`);
  console.log(`  源: ${source}`);
  console.log(`  目标: ${target}`);
  const { copied, skipped } = copyPackFiltered(source, target);
  console.log(`  完成: 复制 ${copied} 个文件，跳过 ${skipped} 项\n`);
}

function main() {
  const minecraftPath = resolveMinecraftPath();
  console.log(`[deploy] MinecraftPath = ${minecraftPath}\n`);

  const targets = [
    {
      label: "Behavior Pack",
      source: BP_ROOT,
      target: path.join(minecraftPath, "development_behavior_packs", "TouHouLittleMaid_BP"),
    },
    {
      label: "Resource Pack",
      source: RP_ROOT,
      target: path.join(minecraftPath, "development_resource_packs", "TouHouLittleMaid_RP"),
    },
    {
      label: "PBR Resource Pack",
      source: PBR_ROOT,
      target: path.join(minecraftPath, "development_resource_packs", "TouHouLittleMaid_PBR"),
    },
  ];

  for (const item of targets) {
    deployOne(item.label, item.source, item.target);
  }

  console.log("[deploy] 全部同步完成。请在游戏中使用 /reload 或重进世界以加载更新。");
}

try {
  main();
} catch (error) {
  console.error("[deploy] 失败:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
