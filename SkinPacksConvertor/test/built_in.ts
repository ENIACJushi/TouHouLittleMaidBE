/**
 * 测试脚本：执行内置包转换，并将合并后的 TouHouLittleMaid_RP
 * 覆盖到 Minecraft 开发资源包目录。
 *
 * 运行：
 *   npm run test:built_in
 *
 * 流程：
 *   1. 调用 npm run build:single，编译合并 HTML 工具
 *   2. 调用 npm run convert:built-in，完成转换并合并到仓库内 TouHouLittleMaid_RP
 *   3. 用新的 TouHouLittleMaid_RP 覆盖
 *      %MinecraftPath%\development_resource_packs\TouHouLittleMaid_RP
 *
 * 需要配置环境变量 MinecraftPath。
 */
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const PACK_FOLDER_NAME = 'TouHouLittleMaid_RP';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDir, '..');
const repoRoot = path.resolve(projectRoot, '..');

function resolveMinecraftPackDir(): string {
  const minecraftPath = process.env.MinecraftPath;
  if (!minecraftPath) {
    throw new Error('需要设置环境变量 MinecraftPath');
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
 * 调用 npm run convert:built-in，继承当前进程的 stdio。
 */
function runConvertBuiltIn(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', 'convert:built-in'], {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: true,
      env: process.env,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`npm run convert:built-in 失败，退出码 ${code}`));
    });
  });
}

/**
 * 调用 npm run build:single，编译合并 HTML 工具，继承当前进程的 stdio。
 */
function runBuildSingle(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', 'build:single'], {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: true,
      env: process.env,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`npm run build:single 失败，退出码 ${code}`));
    });
  });
}

/**
 * 用仓库内的 TouHouLittleMaid_RP 整包覆盖 Minecraft 开发资源包目录。
 */
async function overwriteMinecraftPack(srcPackDir: string, destPackDir: string): Promise<void> {
  await fs.rm(destPackDir, { recursive: true, force: true });
  await fs.mkdir(path.dirname(destPackDir), { recursive: true });
  await fs.cp(srcPackDir, destPackDir, { recursive: true });
  console.log(`已覆盖开发资源包: ${destPackDir}`);
}

async function main() {
  const srcPackDir = path.join(repoRoot, PACK_FOLDER_NAME);
  const destPackDir = resolveMinecraftPackDir();

  if (!(await pathExists(srcPackDir))) {
    throw new Error(`资源包目录不存在: ${srcPackDir}`);
  }

  console.log('步骤 1/3: 编译合并 HTML 工具（npm run build:single）');
  await runBuildSingle();

  console.log('步骤 2/3: 执行内置包转换（npm run convert:built-in）');
  await runConvertBuiltIn();

  console.log('步骤 3/3: 覆盖 Minecraft 开发资源包');
  console.log(`源目录: ${srcPackDir}`);
  console.log(`目标目录: ${destPackDir}`);
  await overwriteMinecraftPack(srcPackDir, destPackDir);

  console.log('test:built_in 完成');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
