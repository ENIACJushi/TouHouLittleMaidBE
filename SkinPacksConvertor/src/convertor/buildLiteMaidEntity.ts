/**
 * 附加包精简子包：在完整转换结果上，换用精简内置实体底板，保留本次新增的模型/贴图/RC。
 */
import MAID_ENTITY_DEF from './config/profile/maid.entity.json';
import MAID_ENTITY_DEF_SIMPLE from './config/profile/maid.entity.simple.json';
import type { AnimationDefinition } from './animation/MaidAnimationConvertor';
import type { TemplatesBE } from './model/Templates';

type MaidDesc = TemplatesBE.EntityDefinition['minecraft:client_entity']['description'];

function addonOnlyEntries(
  fullBase: Record<string, string> | undefined,
  converted: Record<string, string> | undefined,
): Record<string, string> {
  const base = fullBase ?? {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(converted ?? {})) {
    if (!(key in base)) {
      out[key] = value;
    }
  }
  return out;
}

/**
 * 由完整转换实体 + 精简底板动画定义，生成 subpacks/simple 用的女仆实体。
 */
export function buildLiteMaidEntityFromFull(
  fullEntity: TemplatesBE.EntityDefinition,
  liteAnimDef: AnimationDefinition,
): TemplatesBE.EntityDefinition {
  const fullBase = MAID_ENTITY_DEF['minecraft:client_entity'].description as MaidDesc & {
    textures?: Record<string, string>;
    geometry?: Record<string, string>;
    render_controllers?: string[];
  };
  const liteBase = MAID_ENTITY_DEF_SIMPLE['minecraft:client_entity'].description as MaidDesc & {
    textures?: Record<string, string>;
    geometry?: Record<string, string>;
    render_controllers?: string[];
  };
  const fullDesc = fullEntity['minecraft:client_entity'].description as MaidDesc & {
    textures?: Record<string, string>;
    geometry?: Record<string, string>;
    render_controllers?: string[];
    scripts?: unknown;
    animations?: Record<string, string>;
  };

  const addonTextures = addonOnlyEntries(fullBase.textures, fullDesc.textures);
  const addonGeometry = addonOnlyEntries(fullBase.geometry, fullDesc.geometry);
  const fullBaseRcLen = Array.isArray(fullBase.render_controllers)
    ? fullBase.render_controllers.length
    : 0;
  const addonRcs = Array.isArray(fullDesc.render_controllers)
    ? fullDesc.render_controllers.slice(fullBaseRcLen)
    : [];

  return {
    format_version: fullEntity.format_version,
    'minecraft:client_entity': {
      description: {
        identifier: fullDesc.identifier,
        textures: {
          ...(liteBase.textures ?? {}),
          ...addonTextures,
        },
        geometry: {
          ...(liteBase.geometry ?? {}),
          ...addonGeometry,
        },
        render_controllers: [
          ...(liteBase.render_controllers ?? []),
          ...addonRcs,
        ],
        scripts: JSON.parse(JSON.stringify(liteAnimDef.scripts)),
        animations: JSON.parse(JSON.stringify(liteAnimDef.animations)),
      },
    },
  };
}
