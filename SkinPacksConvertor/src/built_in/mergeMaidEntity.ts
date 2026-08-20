import { MAID_ENTITY_DEF_BASIC } from '../maid_basic';

function cloneJson<T>(value: T): T {
  if (value === undefined) {
    return value;
  }
  return JSON.parse(JSON.stringify(value));
}

/** 女仆客户端实体 description 的宽松类型，仅覆盖合并用到的字段 */
interface MaidEntityDescription {
  identifier?: string;
  materials?: Record<string, string>;
  spawn_egg?: Record<string, unknown>;
  scripts?: unknown;
  animations?: unknown;
  render_controllers?: unknown;
  textures?: Record<string, string>;
  geometry?: Record<string, string>;
  [key: string]: unknown;
}

interface MaidEntityFile {
  format_version?: string;
  'minecraft:client_entity': {
    description: MaidEntityDescription;
  };
}

/**
 * 合并内置包实体定义（A）与基础模板（B）
 *  规则见 src/built_in/README.md
 */
export function mergeMaidEntity(innerPackEntity: MaidEntityFile): MaidEntityFile {
  const descA = innerPackEntity?.['minecraft:client_entity']?.description;
  const descB = MAID_ENTITY_DEF_BASIC['minecraft:client_entity'].description as MaidEntityDescription;

  if (!descA) {
    throw new Error('内置包 maid.entity.json 缺少 minecraft:client_entity.description');
  }

  const mergedDescription: MaidEntityDescription = {
    // 使用基础模板包（B）
    identifier: descB.identifier,
    materials: cloneJson(descB.materials),
    // 二者合并：基础模板在前，内置包同名键覆盖
    textures: {
      ...cloneJson(descB.textures ?? {}),
      ...cloneJson(descA.textures ?? {}),
    },
    geometry: {
      ...cloneJson(descB.geometry ?? {}),
      ...cloneJson(descA.geometry ?? {}),
    },
    // 使用内置包（A）
    scripts: cloneJson(descA.scripts),
    animations: cloneJson(descA.animations),
    render_controllers: cloneJson(descA.render_controllers),
    // 使用基础模板包（B）
    spawn_egg: cloneJson(descB.spawn_egg),
  };

  return {
    format_version: innerPackEntity.format_version ?? MAID_ENTITY_DEF_BASIC.format_version,
    'minecraft:client_entity': {
      description: mergedDescription,
    },
  };
}
