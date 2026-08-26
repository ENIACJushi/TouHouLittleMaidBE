import { CHAIR_ENTITY_DEF_BASIC } from '../chair_basic';

function cloneJson<T>(value: T): T {
  if (value === undefined) {
    return value;
  }
  return JSON.parse(JSON.stringify(value));
}

/** 坐垫客户端实体 description 的宽松类型，仅覆盖合并用到的字段 */
interface ChairEntityDescription {
  identifier?: string;
  materials?: Record<string, string>;
  scripts?: unknown;
  animations?: unknown;
  render_controllers?: unknown;
  textures?: Record<string, string>;
  geometry?: Record<string, string>;
  [key: string]: unknown;
}

interface ChairEntityFile {
  format_version?: string;
  'minecraft:client_entity': {
    description: ChairEntityDescription;
  };
}

/**
 * 合并内置坐垫包实体定义（A）与基础模板（B）
 *  规则与女仆合并（mergeMaidEntity）保持一致，坐垫无 spawn_egg。
 */
export function mergeChairEntity(innerPackEntity: ChairEntityFile): ChairEntityFile {
  const descA = innerPackEntity?.['minecraft:client_entity']?.description;
  const descB = CHAIR_ENTITY_DEF_BASIC['minecraft:client_entity'].description as ChairEntityDescription;

  if (!descA) {
    throw new Error('内置包 chair.entity.json 缺少 minecraft:client_entity.description');
  }

  const mergedDescription: ChairEntityDescription = {
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
  };

  return {
    format_version: innerPackEntity.format_version ?? CHAIR_ENTITY_DEF_BASIC.format_version,
    'minecraft:client_entity': {
      description: mergedDescription,
    },
  };
}
