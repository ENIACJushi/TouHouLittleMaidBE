/**
 * 测试脚本：调用皮肤转换器，将官方 Java 模型包 / YSM 模型包转为基岩版皮肤包
 *
 * 源目录：
 *   TLM 默认：tools/touhou_little_maid-1.0.0-bedrock
 *   YSM：仓库 .ref/koishi（npm run test:convert -- --ysm）
 * 输出：test/output/TLM_MaidSkinPack/ 与 test/output/TLM_MaidSkinPack.mcpack
 *
 * 运行：
 *   npm run test:convert
 *   npm run test:convert -- --ysm
 *   npm run test:convert -m
 *   npm run test:convert --move
 *   npm run test:convert --uuid=<uuid>
 *   npm run test:convert -u=<uuid>
 * 可选参数：
 *   -u / --uuid  指定资源包 UUID（不传则使用内置测试 UUID；npm 传参需用等号，如 --uuid=xxx）
 *   -m / --move  同步到 %MinecraftPath%\development_resource_packs\TLM_MaidSkinPack
 *                目标目录已有文件时，先删除 manifest.json 以外的内容，且不覆盖 manifest.json
 *   --ysm        使用 .ref/koishi 作为 YSM 样例包（zip 引入）
 */
import './node-polyfill';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';
import { SkinConvertor } from '../src/convertor/SkinConvertor';
import { getErrorLog } from './node-polyfill';

/** 固定 UUID，方便反复覆盖同一份开发资源包 */
const TEST_UUID = 'afc1c4e6-3bf4-4344-8dea-77425d8d6435';

const PACK_FOLDER_NAME = 'TLM_MaidSkinPack';
const MANIFEST_FILE = 'manifest.json';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDir, '..');
const repoRoot = path.resolve(projectRoot, '..');

interface ConvertArgs {
  uuid: string;
  moveToMinecraft: boolean;
  useYsm: boolean;
}

/**
 * npm 会把 `npm run xxx --move` 写成 npm_config_move，把 `-m` 写成 npm_config_message
 */
function npmConfigEnabled(name: string): boolean {
  const value = process.env[`npm_config_${name}`];
  return value !== undefined && value !== 'false';
}

/** 读取 npm 配置值（如 --uuid=xxx → npm_config_uuid） */
function npmConfigValue(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[`npm_config_${name}`];
    if (value !== undefined && value !== '') {
      return value;
    }
  }
  return undefined;
}

/**
 * 解析命令行与 npm 传参：
 *   -m / --move → 安装开关
 *   -u / --uuid → UUID（npm 侧需写成 -u=xxx / --uuid=xxx）
 *   --ysm → 使用 YSM 样例包
 */
function parseArgs(argv: string[]): ConvertArgs {
  // npm run test:convert --move → npm_config_move=true
  // npm run test:convert -m     → npm 把 -m 当成 --message，值为空字符串
  let moveToMinecraft = npmConfigEnabled('move') || process.env.npm_config_message === '';
  // npm run test:convert --uuid=xxx → npm_config_uuid
  // npm run test:convert -u=xxx     → npm_config_u
  let uuid = npmConfigValue('uuid', 'u') ?? TEST_UUID;
  let useYsm = npmConfigEnabled('ysm');

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-m' || arg === '--move') {
      moveToMinecraft = true;
      continue;
    }
    if (arg === '--ysm') {
      useYsm = true;
      continue;
    }
    if (arg === '-u' || arg === '--uuid') {
      const next = argv[i + 1];
      if (!next || next.startsWith('-')) {
        throw new Error(`${arg} 需要指定 UUID，例如 ${arg}=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`);
      }
      uuid = next;
      i++;
      continue;
    }
    if (arg.startsWith('-u=')) {
      uuid = arg.slice(3);
      continue;
    }
    if (arg.startsWith('--uuid=')) {
      uuid = arg.slice(7);
      continue;
    }
    if (arg.startsWith('-')) {
      throw new Error(`未知参数: ${arg}`);
    }
    throw new Error(`未知参数: ${arg}（UUID 请使用 -u= / --uuid=）`);
  }
  return { uuid, moveToMinecraft, useYsm };
}

function resolveMinecraftPackDir(): string {
  const minecraftPath = process.env.MinecraftPath;
  if (!minecraftPath) {
    throw new Error('使用 -m / --move 时需要设置环境变量 MinecraftPath');
  }
  return path.join(minecraftPath, 'development_resource_packs', PACK_FOLDER_NAME);
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

/**
 * 清空目标目录中除根目录 manifest.json 以外的文件和子目录
 */
async function clearDirKeepManifest(dir: string): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() && entry.name === MANIFEST_FILE) {
      continue;
    }
    await fs.rm(path.join(dir, entry.name), { recursive: true, force: true });
  }
}

/**
 * 将生成的皮肤包同步到 Minecraft 开发资源包目录。
 * 若目标已有 manifest.json，则保留不覆盖。
 */
async function installToMinecraft(srcPackDir: string, destPackDir: string): Promise<void> {
  await fs.mkdir(destPackDir, { recursive: true });
  const keepManifest = await pathExists(path.join(destPackDir, MANIFEST_FILE));
  await clearDirKeepManifest(destPackDir);

  await fs.cp(srcPackDir, destPackDir, {
    recursive: true,
    filter: (source) => {
      if (!keepManifest) {
        return true;
      }
      return path.resolve(source) !== path.resolve(srcPackDir, MANIFEST_FILE);
    },
  });

  console.log(`已安装到开发资源包: ${destPackDir}`);
  if (keepManifest) {
    console.log(`已保留原有 ${MANIFEST_FILE}，未覆盖`);
  }
}

/**
 * 将目录打成 zip buffer，供 SkinConvertor / JSZip.loadAsync 使用
 */
async function zipFolder(folder: string): Promise<Buffer> {
  const zip = new JSZip();

  async function walk(dir: string, zipPrefix: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel = zipPrefix ? `${zipPrefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(full, rel);
      } else {
        zip.file(rel, await fs.readFile(full));
      }
    }
  }

  await walk(folder, '');
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

/**
 * 将 zip 解压到目录（先清空目标目录）
 */
async function writeZipToDir(zipBuffer: Buffer, outDir: string) {
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });
  const zip = await JSZip.loadAsync(zipBuffer);
  for (const file of Object.values(zip.files)) {
    if (file.dir) {
      continue;
    }
    const dest = path.join(outDir, file.name);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, await file.async('nodebuffer'));
  }
}

async function main() {
  const { uuid, moveToMinecraft, useYsm } = parseArgs(process.argv.slice(2));
  const minecraftPackDir = moveToMinecraft ? resolveMinecraftPackDir() : '';

  const sourceDir = useYsm
    ? path.join(repoRoot, '.ref', 'koishi')
    : path.join(projectRoot, 'tools', 'touhou_little_maid-1.0.0-bedrock');
  const zipName = useYsm ? 'koishi.zip' : 'touhou_little_maid-1.0.0-bedrock.zip';
  const outputRoot = path.join(testDir, 'output');
  const packDir = path.join(outputRoot, PACK_FOLDER_NAME);
  const mcpackPath = path.join(outputRoot, `${PACK_FOLDER_NAME}.mcpack`);

  const sourceStat = await fs.stat(sourceDir).catch(() => undefined);
  if (!sourceStat?.isDirectory()) {
    throw new Error(`源目录不存在: ${sourceDir}`);
  }

  console.log(`模式: ${useYsm ? 'YSM' : 'TLM'}`);
  console.log(`源目录: ${sourceDir}`);
  console.log(`UUID: ${uuid}`);
  if (moveToMinecraft) {
    console.log(`安装目标: ${minecraftPackDir}`);
  }
  console.log('正在打包源模型包...');
  const packBuffer = await zipFolder(sourceDir);
  const packFile = Object.assign(packBuffer, {
    name: zipName,
  });

  console.log('开始转换...');
  const convertor = new SkinConvertor([packFile]);
  const result = await convertor.startConvert(uuid);
  if (!result) {
    throw new Error('转换失败：未返回结果');
  }

  console.log(`管理面板数据: ${result.commandConfigStr}`);

  const zipBuffer = await result.resultFile.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });

  await fs.mkdir(outputRoot, { recursive: true });
  await fs.writeFile(mcpackPath, zipBuffer);
  await writeZipToDir(zipBuffer, packDir);

  const err = getErrorLog();
  if (err.trim()) {
    console.warn('转换过程中的错误日志:');
    console.warn(err);
  }

  console.log(`已写出资源包目录: ${packDir}`);
  console.log(`已写出 mcpack: ${mcpackPath}`);

  if (moveToMinecraft) {
    await installToMinecraft(packDir, minecraftPackDir);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
