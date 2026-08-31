/**
 * 精简子资源包（Bedrock subpacks）迁移
 *
 * 将「修改过 geckolib maid_model.json」的二次转换产物写入：
 *   TouHouLittleMaid_RP/subpacks/simple/
 *
 * 子包内需自洽：实体引用的 animation 名与完整包不一致，
 * 因此一并覆写动画与渲染控制器（模型/贴图仍用根目录完整资源）。
 *
 * 参考：https://wiki.bedrock.dev/concepts/subpacks
 *       https://learn.microsoft.com/minecraft/creator/documents/buildingsubpacks
 */
import * as fs from 'fs/promises';
import * as path from 'path';

/** 精简档 folder_name（manifest.subpacks） */
export const SIMPLE_SUBPACK_FOLDER = 'simple';
/** 完整档 folder_name：空目录，较高 memory_tier，保证默认选用根目录完整定义 */
export const FULL_SUBPACK_FOLDER = 'full';

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function copyIfExists(src: string, dest: string): Promise<boolean> {
  if (!(await pathExists(src))) {
    return false;
  }
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
  return true;
}

/**
 * 将精简转换中间产物中的女仆渲染相关文件写入 RP 子资源包。
 * @param simplePackDir 精简转换解压目录（TLM_MaidSkinPack_simple）
 * @param rpDir TouHouLittleMaid_RP
 * @param mergedMaidEntity 已与 maid_basic 合并后的精简实体定义
 */
export async function migrateSimpleSubpackResources(
  simplePackDir: string,
  rpDir: string,
  mergedMaidEntity: unknown,
): Promise<void> {
  const simpleRoot = path.join(rpDir, 'subpacks', SIMPLE_SUBPACK_FOLDER);
  await fs.rm(simpleRoot, { recursive: true, force: true });
  await fs.mkdir(simpleRoot, { recursive: true });

  // 生物渲染定义（子包覆盖根目录 entity/maid/maid.entity.json）
  const entityDest = path.join(simpleRoot, 'entity', 'maid', 'maid.entity.json');
  await fs.mkdir(path.dirname(entityDest), { recursive: true });
  await fs.writeFile(
    entityDest,
    `${JSON.stringify(mergedMaidEntity, null, '\t')}\n`,
    'utf8',
  );
  console.log(`已写入精简子包实体定义: ${entityDest}`);

  // 动画：与精简实体 scripts/animations 引用一致
  const srcAnim = path.join(simplePackDir, 'animations', 'tlm_pack_maid.animation.json');
  const destAnim = path.join(
    simpleRoot,
    'animations',
    'built_in_skins',
    'tlm_pack_maid.animation.json',
  );
  if (await copyIfExists(srcAnim, destAnim)) {
    console.log(`已写入精简子包动画: ${destAnim}`);
  } else {
    console.warn(`精简转换缺少动画文件: ${srcAnim}`);
  }

  // 渲染控制器：geometry/texture 数组长度随模型数变化
  const srcRc = path.join(simplePackDir, 'render_controllers', 'maid.json');
  const destRc = path.join(
    simpleRoot,
    'render_controllers',
    'maid',
    'built_in_skins.json',
  );
  if (await copyIfExists(srcRc, destRc)) {
    console.log(`已写入精简子包渲染控制器: ${destRc}`);
  } else {
    console.warn(`精简转换缺少渲染控制器: ${srcRc}`);
  }

  // 完整档占位目录（manifest 中更高 memory_tier，默认选用，无覆盖文件 → 用根目录完整定义）
  const fullRoot = path.join(rpDir, 'subpacks', FULL_SUBPACK_FOLDER);
  await fs.mkdir(fullRoot, { recursive: true });
  const keep = path.join(fullRoot, '.gitkeep');
  if (!(await pathExists(keep))) {
    await fs.writeFile(keep, '', 'utf8');
  }
}
