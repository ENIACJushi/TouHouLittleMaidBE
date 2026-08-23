import * as fs from 'fs/promises';
import * as path from 'path';

const LANG_BLOCK_START = '##### BUILT_IN_SKINS_START #####';
const LANG_BLOCK_END = '##### BUILT_IN_SKINS_END #####';
/** 贴图目录：不清空目标，只把源文件拷进去，同名覆盖 */
const MERGE_TEXTURE_FOLDERS = new Set(['thlm']);

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

/** 列出目录下的直接子项 */
async function listEntries(dir: string) {
  if (!(await pathExists(dir))) {
    return [];
  }
  return fs.readdir(dir, { withFileTypes: true });
}

/** 删除目录后重建为空文件夹 */
async function resetDir(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
}

/**
 * 先删除目标文件夹，再把源文件夹拷过去。
 * 注意：必须先保证 dest 不存在，否则 Node 的 fs.cp 会把源目录嵌进目标目录。
 */
async function replaceDirContents(srcDir: string, destDir: string): Promise<void> {
  await fs.rm(destDir, { recursive: true, force: true });
  await fs.mkdir(path.dirname(destDir), { recursive: true });
  await fs.cp(srcDir, destDir, { recursive: true });
}

/**
 * 把源目录文件合并进目标目录：同名覆盖，目标中多出来的文件保留
 */
async function mergeDirFiles(srcDir: string, destDir: string): Promise<void> {
  await fs.mkdir(destDir, { recursive: true });
  for (const entry of await listEntries(srcDir)) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      await mergeDirFiles(src, dest);
    } else {
      await fs.copyFile(src, dest);
    }
  }
}

function detectEol(text: string): string {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

function normalizeToEol(text: string, eol: string): string {
  return text.replace(/\r?\n/g, eol);
}

/**
 * 将内置包 lang 内容写入目标 lang 文件的标记块中。
 * 若已有标记则替换中间内容；否则追加到文件末尾。
 */
export function mergeLangFileContent(existing: string | undefined, innerContent: string): string {
  const eol = existing ? detectEol(existing) : '\n';
  const inner = normalizeToEol(innerContent.replace(/\s+$/, ''), eol);
  const block = `${LANG_BLOCK_START}${eol}${inner}${eol}${LANG_BLOCK_END}`;

  if (!existing || existing.length === 0) {
    return block + eol;
  }

  const start = existing.indexOf(LANG_BLOCK_START);
  const end = existing.indexOf(LANG_BLOCK_END);
  if (start >= 0 && end > start) {
    const before = existing.slice(0, start);
    const after = existing.slice(end + LANG_BLOCK_END.length);
    const trimmedBefore = before.replace(/\s+$/, '');
    const trimmedAfter = after.replace(/^\s+/, '');
    const parts = [trimmedBefore, block];
    if (trimmedAfter.length > 0) {
      parts.push(trimmedAfter.replace(/\s+$/, ''));
    }
    return parts.join(eol) + eol;
  }

  const trimmed = existing.replace(/\s+$/, '');
  return `${trimmed}${eol}${block}${eol}`;
}

/**
 * 把内置包没有、资源包也没有的语言代码追加进去
 */
export function mergeLanguagesJson(existing: unknown, inner: unknown): string[] {
  const toList = (value: unknown): string[] => {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((item): item is string => typeof item === 'string');
  };
  const result = [...toList(existing)];
  const known = new Set(result);
  for (const lang of toList(inner)) {
    if (!known.has(lang)) {
      result.push(lang);
      known.add(lang);
    }
  }
  return result;
}

/**
 * 将中间产物 TLM_MaidSkinPack 迁移到 TouHouLittleMaid_RP
 */
export async function migrateBuiltInResources(innerPackDir: string, rpDir: string): Promise<void> {
  // animations → animations/built_in_skins
  const srcAnimations = path.join(innerPackDir, 'animations');
  const destAnimations = path.join(rpDir, 'animations', 'built_in_skins');
  if (await pathExists(srcAnimations)) {
    await replaceDirContents(srcAnimations, destAnimations);
    console.log(`已迁移动画: ${destAnimations}`);
  }

  // models/entity 下的文件夹 → models/entity/built_in_skins
  const srcModels = path.join(innerPackDir, 'models', 'entity');
  const destModels = path.join(rpDir, 'models', 'entity', 'built_in_skins');
  await resetDir(destModels);
  for (const entry of await listEntries(srcModels)) {
    if (!entry.isDirectory()) {
      continue;
    }
    await fs.cp(path.join(srcModels, entry.name), path.join(destModels, entry.name), {
      recursive: true,
    });
  }
  console.log(`已迁移模型: ${destModels}`);

  // textures 下的文件夹 → textures/<同名文件夹>
  // thlm 等合并目录：不清空目标，只覆盖同名文件
  const srcTextures = path.join(innerPackDir, 'textures');
  const destTexturesRoot = path.join(rpDir, 'textures');
  for (const entry of await listEntries(srcTextures)) {
    if (!entry.isDirectory()) {
      continue;
    }
    const src = path.join(srcTextures, entry.name);
    const dest = path.join(destTexturesRoot, entry.name);
    if (MERGE_TEXTURE_FOLDERS.has(entry.name)) {
      await mergeDirFiles(src, dest);
      console.log(`已合并贴图: ${dest}`);
      continue;
    }
    await replaceDirContents(src, dest);
    console.log(`已迁移贴图: ${dest}`);
  }

  // render_controllers/maid.json → render_controllers/maid/built_in_skins.json
  const srcRender = path.join(innerPackDir, 'render_controllers', 'maid.json');
  const destRender = path.join(rpDir, 'render_controllers', 'maid', 'built_in_skins.json');
  if (await pathExists(srcRender)) {
    await fs.mkdir(path.dirname(destRender), { recursive: true });
    await fs.copyFile(srcRender, destRender);
    console.log(`已覆写渲染控制器: ${destRender}`);
  }

  // texts：lang 按标记块追加；languages.json 补齐缺失项
  const srcTexts = path.join(innerPackDir, 'texts');
  const destTexts = path.join(rpDir, 'texts');
  await fs.mkdir(destTexts, { recursive: true });
  for (const entry of await listEntries(srcTexts)) {
    if (entry.isDirectory()) {
      continue;
    }
    const srcFile = path.join(srcTexts, entry.name);
    const destFile = path.join(destTexts, entry.name);

    if (entry.name === 'languages.json') {
      const innerJson = JSON.parse(await fs.readFile(srcFile, 'utf8'));
      let existingJson: unknown = [];
      if (await pathExists(destFile)) {
        existingJson = JSON.parse(await fs.readFile(destFile, 'utf8'));
      }
      const merged = mergeLanguagesJson(existingJson, innerJson);
      await fs.writeFile(destFile, `${JSON.stringify(merged, null, '\t')}\n`, 'utf8');
      console.log(`已合并语言列表: ${destFile}`);
      continue;
    }

    if (!entry.name.endsWith('.lang')) {
      continue;
    }
    const innerContent = await fs.readFile(srcFile, 'utf8');
    const existing = (await pathExists(destFile))
      ? await fs.readFile(destFile, 'utf8')
      : undefined;
    await fs.writeFile(destFile, mergeLangFileContent(existing, innerContent), 'utf8');
    console.log(`已合并语言文件: ${destFile}`);
  }
}

/**
 * 将中间产物中的坐垫资源迁移到 TouHouLittleMaid_RP
 * 坐垫模型/贴图沿用与女仆一致的迁移策略：
 *  - 坐垫几何体目录 → models/entity/built_in_chairs（清空重建）
 *  - 坐垫 render_controllers/chair.json → render_controllers/chair/chair.json
 *  - 坐垫 entity/chair.entity.json → entity/chair/chair.entity.json
 *  - 坐垫 textures/<packName> → textures/<packName>（合并）
 *  - 坐垫 animations/tlm_pack_chair.animation.json → animations/built_in_chairs/
 *  - chair_pack.json → 写入 RP 根目录，供游戏读取坐垫包配置
 */
export async function migrateBuiltInChairResources(innerPackDir: string, rpDir: string): Promise<void> {
  // 坐垫动画 → animations/built_in_chairs
  const srcChairAnim = path.join(innerPackDir, 'animations', 'tlm_pack_chair.animation.json');
  if (await pathExists(srcChairAnim)) {
    const destChairAnims = path.join(rpDir, 'animations', 'built_in_chairs');
    await fs.mkdir(destChairAnims, { recursive: true });
    await fs.copyFile(srcChairAnim, path.join(destChairAnims, 'tlm_pack_chair.animation.json'));
    console.log(`已迁移动画: ${destChairAnims}`);
  }

  // 坐垫几何体 → models/entity/built_in_chairs
  const srcChairModels = path.join(innerPackDir, 'models', 'entity');
  const destChairModels = path.join(rpDir, 'models', 'entity', 'built_in_chairs');
  const srcSubPacks = await listEntries(srcChairModels);
  if (srcSubPacks.length > 0) {
    await resetDir(destChairModels);
    for (const entry of srcSubPacks) {
      if (!entry.isDirectory()) {
        continue;
      }
      await fs.cp(path.join(srcChairModels, entry.name), path.join(destChairModels, entry.name), {
        recursive: true,
      });
    }
    console.log(`已迁移坐垫模型: ${destChairModels}`);
  }

  // 坐垫 render_controllers/chair.json → render_controllers/chair/chair.json
  const srcChairRender = path.join(innerPackDir, 'render_controllers', 'chair.json');
  const destChairRender = path.join(rpDir, 'render_controllers', 'chair', 'chair.json');
  if (await pathExists(srcChairRender)) {
    await fs.mkdir(path.dirname(destChairRender), { recursive: true });
    await fs.copyFile(srcChairRender, destChairRender);
    console.log(`已覆写坐垫渲染控制器: ${destChairRender}`);
  }

  // 坐垫 entity/chair.entity.json → entity/chair/chair.entity.json
  const srcChairEntity = path.join(innerPackDir, 'entity', 'chair.entity.json');
  const destChairEntity = path.join(rpDir, 'entity', 'chair', 'chair.entity.json');
  if (await pathExists(srcChairEntity)) {
    await fs.mkdir(path.dirname(destChairEntity), { recursive: true });
    await fs.copyFile(srcChairEntity, destChairEntity);
    console.log(`已覆写坐垫实体定义: ${destChairEntity}`);
  }

  // 坐垫贴图目录 → textures/<同名>（合并覆盖）
  const srcTextures = path.join(innerPackDir, 'textures');
  const destTexturesRoot = path.join(rpDir, 'textures');
  for (const entry of await listEntries(srcTextures)) {
    if (!entry.isDirectory()) {
      continue;
    }
    // 只在目标中都是合并目录的前提下合并；这里把坐垫贴图并入同名目录
    await mergeDirFiles(path.join(srcTextures, entry.name), path.join(destTexturesRoot, entry.name));
    console.log(`已合并坐垫贴图: ${path.join(destTexturesRoot, entry.name)}`);
  }

  // chair_pack.json → RP 根目录
  const srcChairPack = path.join(innerPackDir, 'chair_pack.json');
  if (await pathExists(srcChairPack)) {
    const destChairPack = path.join(rpDir, 'chair_pack.json');
    await fs.copyFile(srcChairPack, destChairPack);
    console.log(`已写入坐垫包配置: ${destChairPack}`);
  }
}
