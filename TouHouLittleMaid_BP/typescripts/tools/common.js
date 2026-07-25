/**
 * 工作流公共路径与过滤逻辑
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** typescripts 目录 */
export const TOOLS_ROOT = __dirname;
/** TouHouLittleMaid_BP */
export const BP_ROOT = path.resolve(__dirname, "../..");
/** 仓库根目录 TouHouLittleMaidBE */
export const REPO_ROOT = path.resolve(BP_ROOT, "..");
export const RP_ROOT = path.join(REPO_ROOT, "TouHouLittleMaid_RP");
export const PBR_ROOT = path.join(REPO_ROOT, "TouHouLittleMaid_PBR");
export const DIST_ROOT = path.join(REPO_ROOT, "dist");

/** 部署 / 打包时需要排除的路径片段（不区分大小写） */
export const EXCLUDE_SEGMENTS = [
  "typescripts",
  "node_modules",
  ".git",
  ".github",
  ".idea",
  ".vscode",
  ".claude",
  "dist",
  ".old",
];

/** 部署 / 打包时需要排除的文件名 */
export const EXCLUDE_NAMES = new Set([
  ".gitignore",
  ".gitattributes",
  ".mcattributes",
  ".ds_store",
  "thumbs.db",
  "desktop.ini",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "eslint.config.js",
  ".prettierrc.json",
  "cp.bat",
  "com.cmd",
]);

/**
 * 判断相对路径是否应被过滤
 * @param {string} relativePath 相对包根目录的路径
 */
export function shouldExclude(relativePath) {
  const normalized = relativePath.split(/[/\\]/).filter(Boolean);
  if (normalized.length === 0) {
    return false;
  }

  const lowerParts = normalized.map((part) => part.toLowerCase());
  for (const part of lowerParts) {
    if (EXCLUDE_SEGMENTS.includes(part)) {
      return true;
    }
    if (EXCLUDE_NAMES.has(part)) {
      return true;
    }
  }

  const baseName = lowerParts[lowerParts.length - 1];
  // 排除源码与临时文件（保留 .js.map 便于游戏内排错）
  if (
    baseName.endsWith(".ts") ||
    baseName.endsWith(".tsx") ||
    baseName.endsWith(".log") ||
    baseName.endsWith(".tmp")
  ) {
    return true;
  }

  return false;
}

/**
 * 解析 Minecraft com.mojang 根目录
 * 优先使用环境变量 MinecraftPath，否则按常见安装路径探测
 */
export function resolveMinecraftPath() {
  const fromEnv = process.env.MinecraftPath?.trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
  }

  const home = os.homedir();
  const localAppData = process.env.LOCALAPPDATA ?? path.join(home, "AppData", "Local");
  const appData = process.env.APPDATA ?? path.join(home, "AppData", "Roaming");

  const candidates = [
    // 新版 Minecraft Bedrock 启动器
    path.join(appData, "Minecraft Bedrock", "Users", "Shared", "games", "com.mojang"),
    // Preview 启动器
    path.join(appData, "Minecraft Bedrock Preview", "Users", "Shared", "games", "com.mojang"),
    // Microsoft Store 正式版
    path.join(
      localAppData,
      "Packages",
      "Microsoft.MinecraftUWP_8wekyb3d8bbwe",
      "LocalState",
      "games",
      "com.mojang",
    ),
    // Preview UWP
    path.join(
      localAppData,
      "Packages",
      "Microsoft.MinecraftWindowsBeta_8wekyb3d8bbwe",
      "LocalState",
      "games",
      "com.mojang",
    ),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    "未找到 Minecraft 开发目录。请设置环境变量 MinecraftPath 指向 com.mojang 根目录，例如：\n" +
      "  set MinecraftPath=%APPDATA%\\Minecraft Bedrock\\Users\\Shared\\games\\com.mojang",
  );
}

/**
 * 递归复制目录，并按过滤规则跳过部分文件
 * @param {string} sourceDir
 * @param {string} targetDir
 * @returns {{ copied: number, skipped: number }}
 */
export function copyPackFiltered(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`源目录不存在: ${sourceDir}`);
  }

  fs.mkdirSync(targetDir, { recursive: true });

  let copied = 0;
  let skipped = 0;

  /**
   * @param {string} currentSource
   * @param {string} currentTarget
   * @param {string} relative
   */
  function walk(currentSource, currentTarget, relative) {
    const entries = fs.readdirSync(currentSource, { withFileTypes: true });
    for (const entry of entries) {
      const relPath = relative ? path.join(relative, entry.name) : entry.name;
      if (shouldExclude(relPath)) {
        skipped += 1;
        continue;
      }

      const srcPath = path.join(currentSource, entry.name);
      const destPath = path.join(currentTarget, entry.name);

      if (entry.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        walk(srcPath, destPath, relPath);
        continue;
      }

      if (entry.isFile()) {
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.copyFileSync(srcPath, destPath);
        copied += 1;
      }
    }
  }

  // 先清空目标目录，保证与源包一致
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(targetDir, { recursive: true });
  walk(sourceDir, targetDir, "");

  return { copied, skipped };
}

/**
 * 读取行为包版本号，用于产物命名
 * @returns {string}
 */
export function readPackVersion() {
  const manifestPath = path.join(BP_ROOT, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const version = manifest?.header?.version;
  if (Array.isArray(version)) {
    return version.join(".");
  }
  if (typeof version === "string") {
    return version;
  }
  return "0.0.0";
}
