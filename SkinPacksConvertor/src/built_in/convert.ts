/**
 * 内置包转换脚本
 *  对 tools/touhou_little_maid-1.0.0-bedrock 执行内置包转换，
 *  再将中间产物合并进 TouHouLittleMaid_RP。
 *
 * 运行：npm run convert:built-in
 */
import '../../test/node-polyfill';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';
import { SkinConvertor } from '../convertor/SkinConvertor';
import { PROFILE } from '../convertor/config';
import { getErrorLog } from '../../test/node-polyfill';
import { mergeMaidEntity } from './mergeMaidEntity';
import { mergeChairEntity } from './mergeChairEntity';
import { migrateBuiltInResources, migrateBuiltInChairResources } from './migrateResources';

const PACK_FOLDER_NAME = 'TLM_MaidSkinPack';
const BUILTIN_UUID = 'afc1c4e6-3bf4-4344-8dea-77425d8d6435';

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(srcDir, '../..');
const repoRoot = path.resolve(projectRoot, '..');

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

/**
 * 将目录打成 zip buffer，供 SkinConvertor 使用
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

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, '\t')}\n`, 'utf8');
}

async function main() {
  // 无论当前 ConvertProfile 开关如何，内置包转换都必须使用内置档案
  PROFILE.loadInternalPackProfile();
  if (PROFILE.BASE_PACK_INDEX !== 0 || PROFILE.CONVERTED_ANIMATION_ID_START !== 100) {
    throw new Error('内置包转换档案加载失败：BASE_PACK_INDEX / CONVERTED_ANIMATION_ID_START 不符合预期');
  }

  const sourceDir = path.join(projectRoot, 'tools', 'touhou_little_maid-1.0.0-bedrock');
  const outputRoot = path.join(projectRoot, 'test', 'output');
  const packDir = path.join(outputRoot, PACK_FOLDER_NAME);
  const rpDir = path.join(repoRoot, 'TouHouLittleMaid_RP');
  const rpEntityPath = path.join(rpDir, 'entity', 'maid', 'maid.entity.json');
  const profileEntityPath = path.join(
    projectRoot,
    'src',
    'convertor',
    'config',
    'profile',
    'maid.entity.json',
  );
  const chairRpEntityPath = path.join(rpDir, 'entity', 'chair', 'chair.entity.json');
  const chairProfileEntityPath = path.join(
    projectRoot,
    'src',
    'convertor',
    'config',
    'profile',
    'chair.entity.json',
  );

  const sourceStat = await fs.stat(sourceDir).catch(() => undefined);
  if (!sourceStat?.isDirectory()) {
    throw new Error(`源目录不存在: ${sourceDir}`);
  }
  if (!(await pathExists(rpDir))) {
    throw new Error(`资源包目录不存在: ${rpDir}`);
  }

  console.log('档案: 内置包转换（USE_INNER_PACK_PROFILE=true）');
  console.log(`源目录: ${sourceDir}`);
  console.log(`中间产物: ${packDir}`);
  console.log(`合并目标: ${rpDir}`);

  console.log('正在打包源模型包...');
  const packBuffer = await zipFolder(sourceDir);
  const packFile = Object.assign(packBuffer, {
    name: 'touhou_little_maid-1.0.0-bedrock.zip',
  });

  console.log('开始转换内置包...');
  const convertor = new SkinConvertor([packFile]);
  const result = await convertor.startConvert(BUILTIN_UUID);
  if (!result) {
    throw new Error('转换失败：未返回结果');
  }
  console.log(`皮肤包配置: ${result.packConfigStr}`);

  const zipBuffer = await result.resultFile.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });
  await fs.mkdir(outputRoot, { recursive: true });
  await writeZipToDir(zipBuffer, packDir);

  const err = getErrorLog();
  if (err.trim()) {
    console.warn('转换过程中的错误日志:');
    console.warn(err);
  }
  console.log(`已写出中间产物: ${packDir}`);

  // 生物渲染定义合并
  const innerEntityPath = path.join(packDir, 'entity', 'maid.entity.json');
  if (!(await pathExists(innerEntityPath))) {
    throw new Error(`中间产物缺少实体定义: ${innerEntityPath}`);
  }
  const innerEntity = JSON.parse(await fs.readFile(innerEntityPath, 'utf8'));
  const mergedEntity = mergeMaidEntity(innerEntity);
  await writeJson(rpEntityPath, mergedEntity);
  await writeJson(profileEntityPath, mergedEntity);
  console.log(`已覆写实体定义: ${rpEntityPath}`);
  console.log(`已覆写实体定义: ${profileEntityPath}`);

  // 坐垫生物渲染定义合并
  const innerChairEntityPath = path.join(packDir, 'entity', 'chair.entity.json');
  if (await pathExists(innerChairEntityPath)) {
    const innerChairEntity = JSON.parse(await fs.readFile(innerChairEntityPath, 'utf8'));
    const mergedChairEntity = mergeChairEntity(innerChairEntity);
    await writeJson(chairRpEntityPath, mergedChairEntity);
    await writeJson(chairProfileEntityPath, mergedChairEntity);
    console.log(`已覆写坐垫实体定义: ${chairRpEntityPath}`);
    console.log(`已覆写坐垫实体定义: ${chairProfileEntityPath}`);
  }

  // 资源迁移
  await migrateBuiltInResources(packDir, rpDir);
  // 坐垫资源迁移
  await migrateBuiltInChairResources(packDir, rpDir);
  console.log('内置包转换完成');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
