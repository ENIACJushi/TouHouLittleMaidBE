import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  buildMaidDefaultPacksBlock,
  MAID_PACKS_BLOCK_END,
  MAID_PACKS_BLOCK_START,
  syncMaidDefaultPacks,
} from '../src/built_in/syncMaidDefaultPacks';
import { mergeTaggedBlock } from '../src/built_in/migrateResources';

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const maidSkinPath = path.resolve(
  srcDir,
  '../../TouHouLittleMaid_BP/typescripts/src/maid/skin/MaidSkin.ts',
);

async function main() {
  const amounts = [41, 11, 4];
  const domains = ['geckolib', 'authors_and_credits', 'minecraft_15th'];
  const block = buildMaidDefaultPacksBlock(amounts, domains, 0);
  console.log(block);

  const existing = await fs.readFile(maidSkinPath, 'utf8');
  if (!existing.includes(MAID_PACKS_BLOCK_START) || !existing.includes(MAID_PACKS_BLOCK_END)) {
    throw new Error('MaidSkin.ts 缺少 BUILT_IN_MAID_PACKS 标签');
  }
  if (!existing.includes('MANUAL_BUILT_IN_MAID_DEFAULT_PACKS')) {
    throw new Error('MaidSkin.ts 缺少手动东方包常量');
  }

  // dry-run：合并结果应仍保留 pack 0
  const merged = mergeTaggedBlock(existing, block, MAID_PACKS_BLOCK_START, MAID_PACKS_BLOCK_END);
  if (!merged.includes('[0, 120]')) {
    throw new Error('合并后丢失手动东方包 [0, 120]');
  }
  if (!merged.includes('[1, 41], // geckolib')) {
    throw new Error('合并后缺少 geckolib 条目');
  }

  await syncMaidDefaultPacks(maidSkinPath, amounts, domains, 0);
  const after = await fs.readFile(maidSkinPath, 'utf8');
  if (after.includes('[1001,')) {
    throw new Error('错误地写入了网页档案 packId（1001+）');
  }
  if (!after.includes('[1, 41], // geckolib')) {
    throw new Error('期望 packId 从 1 开始');
  }
  console.log('syncMaidDefaultPacks OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
