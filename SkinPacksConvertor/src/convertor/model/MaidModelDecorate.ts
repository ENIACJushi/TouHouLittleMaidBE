/**
 * 对齐 Java `CustomModelPack.decorate` / `MaidModelInfo.decorate` / `MaidModelInfo.extra`：
 * - 补全 model / texture / name 缺省；
 * - 将 `extra_textures` 拆成「同模型不同贴图」的独立条目。
 */

import { TLMMaidModelInfo, TLMResourceLocation } from './MaidModelJava';
import { md5Hex } from '../util/md5';

/** 解析 `namespace:path`；无冒号时整串作为 path，namespace 为空 */
export function splitResourceLocation(loc: string): { namespace: string; path: string } {
  const i = loc.indexOf(':');
  if (i < 0) {
    return { namespace: '', path: loc };
  }
  return { namespace: loc.substring(0, i), path: loc.substring(i + 1) };
}

/**
 * 单模型 decorate：补全缺省字段（不处理 extra_textures 拆分）。
 * 缩放 clamp 在转换器解析阶段仍会再做一次，此处与 Java 一致先限制一次。
 */
export function decorateMaidModelInfo(info: TLMMaidModelInfo): TLMMaidModelInfo {
  if (!info.model_id) {
    throw new Error('Expected "model_id" in model');
  }
  const id = splitResourceLocation(info.model_id);
  const out: TLMMaidModelInfo = { ...info };

  // description 缺省时留给转换器回退 lang，不在此填空数组
  if (!out.model) {
    out.model = `${id.namespace}:models/entity/${id.path}.json`;
  }
  if (!out.texture) {
    out.texture = `${id.namespace}:textures/entity/${id.path}.png`;
  }
  if (out.easter_egg) {
    out.name = out.easter_egg.encrypt
      ? '{gui.touhou_little_maid.model_gui.easter_egg.encrypt}'
      : '{gui.touhou_little_maid.model_gui.easter_egg.normal}';
  }
  if (out.name === undefined) {
    out.name = `{model.${id.namespace}.${id.path}.name}`;
  }
  if (out.render_entity_scale !== undefined) {
    out.render_entity_scale = Math.max(0.2, Math.min(2, out.render_entity_scale));
  }
  return out;
}

/**
 * 派生同模型不同贴图条目（对齐 `MaidModelInfo.extra`，不复制 extra_textures）。
 */
function cloneWithTexture(
  base: TLMMaidModelInfo,
  newModelId: TLMResourceLocation,
  texture: TLMResourceLocation,
): TLMMaidModelInfo {
  const { extra_textures: _drop, ...rest } = base;
  void _drop;
  return {
    ...rest,
    model_id: newModelId,
    texture,
  };
}

/**
 * 展开 model_list：每个基础模型先 decorate，再按 extra_textures 派生条目。
 * 派生 model_id：`<namespace>:<path>_<md5(贴图 ResourceLocation.path).toLowerCase()>`。
 */
export function expandMaidModelList(modelList: TLMMaidModelInfo[]): TLMMaidModelInfo[] {
  const decorated = modelList.map(decorateMaidModelInfo);
  const expanded: TLMMaidModelInfo[] = [];

  for (const item of decorated) {
    const id = splitResourceLocation(item.model_id);
    // 主贴图条目（保留原 model_id）
    expanded.push(cloneWithTexture(item, item.model_id, item.texture!));

    const extras = item.extra_textures;
    if (!extras || extras.length === 0) {
      continue;
    }
    for (const tex of extras) {
      const texPath = splitResourceLocation(tex).path;
      const suffix = md5Hex(texPath).toLowerCase();
      const newModelId = `${id.namespace}:${id.path}_${suffix}`;
      expanded.push(cloneWithTexture(item, newModelId, tex));
    }
  }
  return expanded;
}
