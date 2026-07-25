/**
 * 打包发布产物：
 * 1. BP / RP 分别打成 .mcpack（实质为 zip）
 * 2. 再将两个 .mcpack 打成 .mcaddon
 */
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import {
  BP_ROOT,
  DIST_ROOT,
  RP_ROOT,
  readPackVersion,
  shouldExclude,
} from "./common.js";

/**
 * 将目录内容写入 JSZip（路径统一使用 /）
 * @param {string} sourceDir
 * @param {JSZip} zip
 * @param {string} relative
 */
function addDirectoryToZip(sourceDir, zip, relative = "") {
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const relPath = relative ? `${relative}/${entry.name}` : entry.name;
    if (shouldExclude(relPath.replaceAll("/", path.sep))) {
      continue;
    }

    const absolute = path.join(sourceDir, entry.name);
    if (entry.isDirectory()) {
      addDirectoryToZip(absolute, zip, relPath);
      continue;
    }
    if (entry.isFile()) {
      zip.file(relPath.replaceAll("\\", "/"), fs.readFileSync(absolute));
    }
  }
}

/**
 * @param {string} sourceDir
 * @returns {Promise<Buffer>}
 */
async function zipDirectory(sourceDir) {
  const zip = new JSZip();
  addDirectoryToZip(sourceDir, zip);
  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
}

/**
 * @param {string} filePath
 * @param {Buffer} buffer
 */
function writeFile(filePath, buffer) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buffer);
  console.log(`[package] 已写出: ${filePath} (${buffer.length} bytes)`);
}

async function main() {
  if (!fs.existsSync(BP_ROOT)) {
    throw new Error(`行为包目录不存在: ${BP_ROOT}`);
  }
  if (!fs.existsSync(RP_ROOT)) {
    throw new Error(`资源包目录不存在: ${RP_ROOT}`);
  }

  const scriptsEntry = path.join(BP_ROOT, "scripts", "main.js");
  if (!fs.existsSync(scriptsEntry)) {
    console.warn(
      `[package] 警告: 未找到 ${scriptsEntry}，请先执行 npm run build 再打包。`,
    );
  }

  const version = readPackVersion();
  const bpMcpackName = "TouHouLittleMaid_BP.mcpack";
  const rpMcpackName = "TouHouLittleMaid_RP.mcpack";
  const mcaddonName = `TouHouLittleMaidBE_${version}.mcaddon`;

  console.log(`[package] 开始打包，版本 ${version}`);
  console.log(`[package] 输出目录: ${DIST_ROOT}`);

  const bpBuffer = await zipDirectory(BP_ROOT);
  const rpBuffer = await zipDirectory(RP_ROOT);

  const bpMcpackPath = path.join(DIST_ROOT, bpMcpackName);
  const rpMcpackPath = path.join(DIST_ROOT, rpMcpackName);
  const mcaddonPath = path.join(DIST_ROOT, mcaddonName);

  writeFile(bpMcpackPath, bpBuffer);
  writeFile(rpMcpackPath, rpBuffer);

  const mcaddonZip = new JSZip();
  mcaddonZip.file(bpMcpackName, bpBuffer);
  mcaddonZip.file(rpMcpackName, rpBuffer);
  const mcaddonBuffer = await mcaddonZip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
  writeFile(mcaddonPath, mcaddonBuffer);

  console.log("[package] 打包完成。");
}

try {
  await main();
} catch (error) {
  console.error("[package] 失败:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
