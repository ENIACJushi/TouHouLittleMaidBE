/**
 * 内置模型包解析顺序配置
 *
 * 数组中的 domain（`assets/<domain>` 文件夹名）按声明顺序优先分配 packId；
 * 未出现在本列表中的子包排在所有已配置包之后，并保持彼此相对顺序不变。
 *
 * 注意：
 * - 女仆包与坐垫包共用同一份 domain 遍历顺序，但各自独立计数（packId / chairPackId）
 * - 包 0（东方 Project）来自 maid_basic，不由本转换产生，也不会被同步脚本改写
 * - 调整顺序后，执行 `npm run convert:built-in` 会自动同步 BP 侧：
 *   - `MaidSkin` 标签块 `BUILT_IN_MAID_DEFAULT_PACKS`（不含手动东方包）
 *   - `ChairSkin.DEFAULT_PACKS` / `DEFAULT_HEIGHTS`
 */
export const BUILTIN_PACK_DOMAIN_ORDER: string[] = [
  'touhou_little_maid', // 东方 Project 模型
  // 东方 Project 模型（旧作）
  // 西方 Project 模型
  'geckolib', // GeckoLib 模型
  'authors_and_credits', // 作者|贡献者
  'minecraft_15th', // Minecraft 模型包
  'next_update_model', // 下次更新模型
];

/**
 * 按配置顺序对 domain 列表排序。
 * 有配置的排在最前（按配置序），未配置的排在其后（稳定保留原相对顺序）。
 */
export function sortDomainsByPackOrder(
  domains: Iterable<string>,
  order: readonly string[],
): string[] {
  const list = Array.from(domains);
  if (!order.length) {
    return list;
  }
  const orderIndex = new Map(order.map((domain, index) => [domain, index]));
  return list
    .map((domain, originalIndex) => ({ domain, originalIndex }))
    .sort((a, b) => {
      const ai = orderIndex.has(a.domain) ? orderIndex.get(a.domain)! : Number.POSITIVE_INFINITY;
      const bi = orderIndex.has(b.domain) ? orderIndex.get(b.domain)! : Number.POSITIVE_INFINITY;
      if (ai !== bi) {
        return ai - bi;
      }
      return a.originalIndex - b.originalIndex;
    })
    .map((item) => item.domain);
}
