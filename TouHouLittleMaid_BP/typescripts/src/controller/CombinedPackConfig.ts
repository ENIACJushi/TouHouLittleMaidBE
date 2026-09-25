import {
  MaidSkin,
  SkinPackConfig,
} from '../maid/main';
import { ChairSkin } from '../chair/skin/ChairSkin';

/**
 * 附加皮肤/坐垫包配置的解析与落盘。
 * - 新格式：{"skin":[...],"chair":[...]}
 * - 旧格式：[{"count":20}] —— 仅女仆
 *
 * 使用场景：
 * - Channel topic `skin`（新产物自动注册，主路径）
 * - ManageForm 粘贴（仅兼容无 BP 的旧资源包）
 */
export type CombinedPackConfig = {
  skin?: SkinPackConfig[];
  chair?: SkinPackConfig[];
};

/**
 * 解析网站导出的模型包配置（兼容旧数组格式）。
 * @returns 解析失败时返回 undefined
 */
export function parseCombinedPackConfig(
  text: string
): CombinedPackConfig | undefined {
  const trimmed = text.trim();
  if (trimmed === '') {
    return { skin: [], chair: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return undefined;
  }

  // 旧格式：仅女仆 [{"count":n}, ...]
  if (Array.isArray(parsed)) {
    const skin = MaidSkin.parsePackConfig(JSON.stringify(parsed));
    if (skin === undefined) {
      return undefined;
    }
    return { skin, chair: undefined };
  }

  if (parsed === null || typeof parsed !== 'object') {
    return undefined;
  }

  const obj = parsed as Record<string, unknown>;
  let skin: SkinPackConfig[] | undefined;
  let chair: SkinPackConfig[] | undefined;

  if (obj.skin !== undefined) {
    skin = MaidSkin.parsePackConfig(JSON.stringify(obj.skin));
    if (skin === undefined) {
      return undefined;
    }
  }
  if (obj.chair !== undefined) {
    chair = ChairSkin.parsePackConfig(JSON.stringify(obj.chair));
    if (chair === undefined) {
      return undefined;
    }
  }

  // 至少要有一侧字段，避免误粘无关 JSON
  if (skin === undefined && chair === undefined) {
    return undefined;
  }
  return { skin, chair };
}

/**
 * 将解析后的配置写入内存与动态属性（整表替换，与管理面板提交一致）。
 * @returns 是否至少应用了一侧
 */
export function applyCombinedPackConfig(combined: CombinedPackConfig): boolean {
  let applied = false;
  if (combined.skin !== undefined) {
    MaidSkin.setSkin(combined.skin);
    applied = true;
  }
  if (combined.chair !== undefined) {
    ChairSkin.setSkin(combined.chair);
    applied = true;
  }
  return applied;
}

/**
 * 将当前附加包配置拼成网站同款 JSON。
 */
export function stringifyCombinedPackConfig(): string {
  return JSON.stringify({
    skin: MaidSkin.extraPacks,
    chair: ChairSkin.extraPacks,
  });
}
