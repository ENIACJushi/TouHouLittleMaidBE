import * as fs from 'fs/promises';
import { mergeTaggedBlock } from './migrateResources';
import { PROFILE } from '../convertor/config';

/** 与 ChairSkin.ts 中标签保持一致 */
export const CHAIR_PACKS_BLOCK_START = '// ##### BUILT_IN_CHAIR_PACKS_START #####';
export const CHAIR_PACKS_BLOCK_END = '// ##### BUILT_IN_CHAIR_PACKS_END #####';
export const CHAIR_HEIGHTS_BLOCK_START = '// ##### BUILT_IN_CHAIR_HEIGHTS_START #####';
export const CHAIR_HEIGHTS_BLOCK_END = '// ##### BUILT_IN_CHAIR_HEIGHTS_END #####';

/**
 * 生成标签块内的常量定义正文（包数量）
 */
export function buildChairDefaultPacksBlock(
  amounts: number[],
  domains: string[] = [],
  chairBasePackIndex = PROFILE.CHAIR_BASE_PACK_INDEX,
): string {
  const lines: string[] = ['const BUILT_IN_CHAIR_DEFAULT_PACKS: [number, number][] = ['];
  for (let i = 0; i < amounts.length; i++) {
    const count = amounts[i];
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
      continue;
    }
    const packId = i + 1 + chairBasePackIndex;
    const domain = domains[i];
    const comment = typeof domain === 'string' && domain.length > 0 ? ` // ${domain}` : '';
    lines.push(`  [${packId}, ${count}],${comment}`);
  }
  lines.push('];');
  return lines.join('\n');
}

/**
 * 生成标签块内的常量定义正文（各模型 mounted_height 像素）
 */
export function buildChairDefaultHeightsBlock(
  amounts: number[],
  heights: number[][] = [],
  domains: string[] = [],
): string {
  const lines: string[] = ['const BUILT_IN_CHAIR_DEFAULT_HEIGHTS: number[][] = ['];
  for (let i = 0; i < amounts.length; i++) {
    const count = amounts[i];
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
      continue;
    }
    const packHeights = heights[i] ?? [];
    const values: number[] = [];
    for (let j = 0; j < count; j++) {
      const h = packHeights[j];
      values.push(typeof h === 'number' && Number.isFinite(h) ? h : 0);
    }
    const domain = domains[i];
    const comment = typeof domain === 'string' && domain.length > 0 ? ` // ${domain}` : '';
    lines.push(`  [${values.join(', ')}],${comment}`);
  }
  lines.push('];');
  return lines.join('\n');
}

/**
 * 用标签块覆写 ChairSkin.ts 中的内置坐垫包常量（不编译 typescript）
 */
export async function syncChairDefaultPacks(
  chairSkinTsPath: string,
  amounts: number[],
  domains: string[] = [],
  heights: number[][] = [],
): Promise<void> {
  let existing = await fs.readFile(chairSkinTsPath, 'utf8');
  const packsInner = buildChairDefaultPacksBlock(amounts, domains);
  const heightsInner = buildChairDefaultHeightsBlock(amounts, heights, domains);

  let updated = mergeTaggedBlock(
    existing,
    packsInner,
    CHAIR_PACKS_BLOCK_START,
    CHAIR_PACKS_BLOCK_END,
  );
  updated = mergeTaggedBlock(
    updated,
    heightsInner,
    CHAIR_HEIGHTS_BLOCK_START,
    CHAIR_HEIGHTS_BLOCK_END,
  );

  if (updated === existing) {
    console.log(`ChairSkin 内置坐垫包无需变更: ${chairSkinTsPath}`);
    return;
  }
  await fs.writeFile(chairSkinTsPath, updated, 'utf8');
  console.log(`已同步 ChairSkin 内置坐垫包: ${chairSkinTsPath}`);
}
