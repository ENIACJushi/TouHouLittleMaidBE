/**
 * 内置包转换脚本
 *  对 tools/touhou_little_maid-1.0.0-bedrock 执行内置包转换，
 *  再将中间产物合并进 TouHouLittleMaid_RP。
 *  另用修改过的 geckolib maid_model.json 做一次精简转换，
 *  将生物渲染定义（及配套动画/RC）写入 RP 子资源包 subpacks/simple。
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
import {
  FULL_SUBPACK_FOLDER,
  migrateSimpleSubpackResources,
  SIMPLE_SUBPACK_FOLDER,
} from './migrateSimpleSubpack';
import { syncChairDefaultPacks } from './syncChairDefaultPacks';
import { syncMaidDefaultPacks } from './syncMaidDefaultPacks';

const PACK_FOLDER_NAME = 'TLM_MaidSkinPack';
const SIMPLE_PACK_FOLDER_NAME = 'TLM_MaidSkinPack_simple';
const BUILTIN_UUID = 'afc1c4e6-3bf4-4344-8dea-77425d8d6435';
/** zip 内覆盖路径：精简 geckolib 模型定义 */
const GECKOLIB_MAID_MODEL_ZIP_PATH = 'assets/geckolib/maid_model.json';

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
 * 将目录打成 zip buffer，供 SkinConvertor 使用。
 * @param overrides zip 相对路径 → 内容（覆盖磁盘文件，用于精简 maid_model）
 */
async function zipFolder(
  folder: string,
  overrides?: Map<string, string | Buffer>,
): Promise<Buffer> {
  const zip = new JSZip();
  const overrideKeys = new Set(
    [...(overrides?.keys() ?? [])].map((k) => k.replace(/\\/g, '/')),
  );

  async function walk(dir: string, zipPrefix: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel = zipPrefix ? `${zipPrefix}/${entry.name}` : entry.name;
      const relPosix = rel.replace(/\\/g, '/');
      if (entry.isDirectory()) {
        await walk(full, rel);
        continue;
      }
      if (overrideKeys.has(relPosix)) {
        continue;
      }
      zip.file(relPosix, await fs.readFile(full));
    }
  }

  await walk(folder, '');
  if (overrides) {
    for (const [rel, content] of overrides) {
      zip.file(rel.replace(/\\/g, '/'), content);
    }
  }
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

/**
 * 执行一次内置档案转换并解压到 outDir。
 */
async function runBuiltinConvert(
  sourceDir: string,
  zipName: string,
  outDir: string,
  overrides?: Map<string, string | Buffer>,
): Promise<NonNullable<Awaited<ReturnType<SkinConvertor['startConvert']>>>> {
  console.log('正在打包源模型包...');
  const packBuffer = await zipFolder(sourceDir, overrides);
  const packFile = Object.assign(packBuffer, { name: zipName });

  console.log('开始转换...');
  const convertor = new SkinConvertor([packFile]);
  const result = await convertor.startConvert(BUILTIN_UUID);
  if (!result) {
    throw new Error('转换失败：未返回结果');
  }
  console.log(`管理面板数据: ${result.commandConfigStr}`);

  const zipBuffer = await result.resultFile.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });
  await fs.mkdir(path.dirname(outDir), { recursive: true });
  await writeZipToDir(zipBuffer, outDir);

  const err = getErrorLog();
  if (err.trim()) {
    console.warn('转换过程中的错误日志:');
    console.warn(err);
  }
  console.log(`已写出中间产物: ${outDir}`);
  return result;
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
  const simplePackDir = path.join(outputRoot, SIMPLE_PACK_FOLDER_NAME);
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
  const profileSimpleEntityPath = path.join(
    projectRoot,
    'src',
    'convertor',
    'config',
    'profile',
    'maid.entity.simple.json',
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
  const slimGeckoMaidModelPath = path.join(
    srcDir,
    'subpack_simple',
    'geckolib_maid_model.json',
  );

  const sourceStat = await fs.stat(sourceDir).catch(() => undefined);
  if (!sourceStat?.isDirectory()) {
    throw new Error(`源目录不存在: ${sourceDir}`);
  }
  if (!(await pathExists(rpDir))) {
    throw new Error(`资源包目录不存在: ${rpDir}`);
  }
  if (!(await pathExists(slimGeckoMaidModelPath))) {
    throw new Error(`精简 geckolib maid_model 不存在: ${slimGeckoMaidModelPath}`);
  }

  console.log('档案: 内置包转换（USE_INNER_PACK_PROFILE=true）');
  if (PROFILE.PACK_DOMAIN_ORDER.length > 0) {
    console.log(`子包顺序配置: ${PROFILE.PACK_DOMAIN_ORDER.join(' → ')}`);
  }
  console.log(`源目录: ${sourceDir}`);
  console.log(`中间产物: ${packDir}`);
  console.log(`精简中间产物: ${simplePackDir}`);
  console.log(`合并目标: ${rpDir}`);

  ///// 1) 完整内置转换 → 根目录 /////
  console.log('\n===== 完整内置转换 =====');
  const result = await runBuiltinConvert(
    sourceDir,
    'touhou_little_maid-1.0.0-bedrock.zip',
    packDir,
  );

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

  // 同步 BP/typescript 内置女仆包常量（标签块替换，不编译 typescript；手动东方包不动）
  const maidSkinTsPath = path.join(
    repoRoot,
    'TouHouLittleMaid_BP',
    'typescripts',
    'src',
    'maid',
    'skin',
    'MaidSkin.ts',
  );
  if (await pathExists(maidSkinTsPath)) {
    await syncMaidDefaultPacks(
      maidSkinTsPath,
      result.modelAmount,
      result.maidPackDomains,
      PROFILE.BASE_PACK_INDEX,
    );
  } else {
    console.warn(`未找到 MaidSkin.ts，跳过内置女仆包同步: ${maidSkinTsPath}`);
  }

  // 同步 BP/typescript 内置坐垫包常量（标签块替换，不编译 typescript）
  const chairSkinTsPath = path.join(
    repoRoot,
    'TouHouLittleMaid_BP',
    'typescripts',
    'src',
    'chair',
    'skin',
    'ChairSkin.ts',
  );
  if (await pathExists(chairSkinTsPath)) {
    await syncChairDefaultPacks(
      chairSkinTsPath,
      result.chairModelAmount,
      result.chairPackDomains,
      result.chairModelHeights,
    );
  } else {
    console.warn(`未找到 ChairSkin.ts，跳过内置坐垫包同步: ${chairSkinTsPath}`);
  }

  ///// 2) 精简转换（覆盖 geckolib maid_model）→ subpacks/simple /////
  console.log('\n===== 精简子资源包转换（geckolib 仅第一个模型）=====');
  const slimMaidModel = await fs.readFile(slimGeckoMaidModelPath);
  const overrides = new Map<string, Buffer>([
    [GECKOLIB_MAID_MODEL_ZIP_PATH, slimMaidModel],
  ]);
  await runBuiltinConvert(
    sourceDir,
    'touhou_little_maid-1.0.0-bedrock-simple.zip',
    simplePackDir,
    overrides,
  );

  const simpleEntityPath = path.join(simplePackDir, 'entity', 'maid.entity.json');
  if (!(await pathExists(simpleEntityPath))) {
    throw new Error(`精简中间产物缺少实体定义: ${simpleEntityPath}`);
  }
  const simpleInnerEntity = JSON.parse(await fs.readFile(simpleEntityPath, 'utf8'));
  const simpleMergedEntity = mergeMaidEntity(simpleInnerEntity);
  await migrateSimpleSubpackResources(simplePackDir, rpDir, simpleMergedEntity);
  // 同步网页转换器用的精简底板（与 subpacks/simple 实体一致）
  await writeJson(profileSimpleEntityPath, simpleMergedEntity);
  console.log(`已覆写精简实体定义: ${profileSimpleEntityPath}`);
  console.log(
    `精简子资源包已写入: subpacks/${SIMPLE_SUBPACK_FOLDER}/ （默认档: subpacks/${FULL_SUBPACK_FOLDER}/）`,
  );

  console.log('\n内置包转换完成');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
