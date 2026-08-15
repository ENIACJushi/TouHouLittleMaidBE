/**
 * 测试脚本：调用皮肤转换器，将官方 Java 模型包转为基岩版皮肤包
 *
 * 源目录：tools/touhou_little_maid-1.0.0-bedrock
 * 输出：test/output/TLM_MaidSkinPack/ 与 test/output/TLM_MaidSkinPack.mcpack
 *
 * 运行：npm run test:convert
 * 可选参数：uuid（不传则使用内置测试 UUID）
 */
import './node-polyfill';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';
import { SkinConvertor } from '../src/convertor/SkinConvertor';
import { getErrorLog } from './node-polyfill';

/** 固定 UUID，方便反复覆盖同一份开发资源包 */
const TEST_UUID = '11111111-2222-4333-8444-555555555555';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDir, '..');

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
  const sourceDir = path.join(projectRoot, 'tools', 'touhou_little_maid-1.0.0-bedrock');
  const outputRoot = path.join(testDir, 'output');
  const packDir = path.join(outputRoot, 'TLM_MaidSkinPack');
  const mcpackPath = path.join(outputRoot, 'TLM_MaidSkinPack.mcpack');
  const uuid = process.argv[2] || TEST_UUID;

  const sourceStat = await fs.stat(sourceDir).catch(() => undefined);
  if (!sourceStat?.isDirectory()) {
    throw new Error(`源目录不存在: ${sourceDir}`);
  }

  console.log(`源目录: ${sourceDir}`);
  console.log(`UUID: ${uuid}`);
  console.log('正在打包源模型包...');
  const packBuffer = await zipFolder(sourceDir);
  const packFile = Object.assign(packBuffer, {
    name: 'touhou_little_maid-1.0.0-bedrock.zip',
  });

  console.log('开始转换...');
  const convertor = new SkinConvertor([packFile]);
  const result = await convertor.startConvert(uuid);
  if (!result) {
    throw new Error('转换失败：未返回结果');
  }

  console.log(`加载指令: ${result.commandStr}`);

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
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
