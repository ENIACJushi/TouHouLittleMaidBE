import * as fs from 'fs/promises';
import { mergeTaggedBlock } from './migrateResources';
import { PROFILE } from '../convertor/config';

/** 与 MaidSkin.ts 中标签保持一致 */
export const MAID_PACKS_BLOCK_START = '// ##### BUILT_IN_MAID_PACKS_START #####';
export const MAID_PACKS_BLOCK_END = '// ##### BUILT_IN_MAID_PACKS_END #####';

/**
 * 生成标签块内的常量定义正文（自动转换的内置女仆包数量）。
 * 不含手动转换的东方包（pack 0），由 MaidSkin.ts 在标签外维护。
 */
export function buildMaidDefaultPacksBlock(
  amounts: number[],
  domains: string[] = [],
  basePackIndex = PROFILE.BASE_PACK_INDEX,
): string {
  const lines: string[] = ['const BUILT_IN_MAID_DEFAULT_PACKS: [number, number][] = ['];
  for (let i = 0; i < amounts.length; i++) {
    const count = amounts[i];
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
      continue;
    }
    const packId = i + 1 + basePackIndex;
    const domain = domains[i];
    const comment = typeof domain === 'string' && domain.length > 0 ? ` // ${domain}` : '';
    lines.push(`  [${packId}, ${count}],${comment}`);
  }
  lines.push('];');
  return lines.join('\n');
}

/**
 * 用标签块覆写 MaidSkin.ts 中自动转换的内置女仆包常量（不编译 typescript）。
 * 手动转换包（东方 pack 0）在标签外，不会被本函数修改。
 *
 * @param basePackIndex 内置构建应传 `0`（与 `PROFILE.loadInternalPackProfile` 一致）；
 *   缺省时读取当前 PROFILE，避免网页档案（1000）误写进内置常量。
 */
export async function syncMaidDefaultPacks(
  maidSkinTsPath: string,
  amounts: number[],
  domains: string[] = [],
  basePackIndex = PROFILE.BASE_PACK_INDEX,
): Promise<void> {
  const existing = await fs.readFile(maidSkinTsPath, 'utf8');
  const packsInner = buildMaidDefaultPacksBlock(amounts, domains, basePackIndex);

  const updated = mergeTaggedBlock(
    existing,
    packsInner,
    MAID_PACKS_BLOCK_START,
    MAID_PACKS_BLOCK_END,
  );

  if (updated === existing) {
    console.log(`MaidSkin 内置女仆包无需变更: ${maidSkinTsPath}`);
    return;
  }
  await fs.writeFile(maidSkinTsPath, updated, 'utf8');
  console.log(`已同步 MaidSkin 内置女仆包: ${maidSkinTsPath}`);
}
