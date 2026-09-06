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
  scripts?: {
    scale?: string;
    initialize?: string[];
    pre_animation?: string[];
    should_update_bones_and_effects_offscreen?: true;
    animate?: (string | Record<string, string>)[];
    [key: string]: unknown;
  };
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

const SHOW_HITBOX_QUERY = "q.property('thlm:show_hitbox')";
const HITBOX_RENDER_CONTROLLER = 'controller.render.touhou_little_maid.chair_hitbox';
const HITBOX_SCALE_OVERRIDE = "q.property('thlm:show_hitbox') ? { v.chair_scale = 1; };";

/**
 * 将渲染控制器列表转为条件形式：
 *  - 原有坐垫皮肤 RC：仅在未显示碰撞箱时启用
 *  - 末尾追加碰撞箱 RC：仅在显示碰撞箱时启用
 */
function buildChairRenderControllers(raw: unknown): Array<string | Record<string, string>> {
  const list = Array.isArray(raw) ? raw : [];
  const result: Array<string | Record<string, string>> = [];
  for (const entry of list) {
    if (typeof entry === 'string') {
      if (entry === HITBOX_RENDER_CONTROLLER) {
        continue;
      }
      result.push({ [entry]: `!${SHOW_HITBOX_QUERY}` });
      continue;
    }
    if (entry && typeof entry === 'object') {
      const keys = Object.keys(entry as Record<string, string>);
      if (keys.length === 1 && keys[0] === HITBOX_RENDER_CONTROLLER) {
        continue;
      }
      result.push(entry as Record<string, string>);
    }
  }
  result.push({ [HITBOX_RENDER_CONTROLLER]: SHOW_HITBOX_QUERY });
  return result;
}

/**
 * 合并内置坐垫包实体定义（A）与基础模板（B）
 *  规则与女仆合并（mergeMaidEntity）保持一致，坐垫无 spawn_egg。
 *  额外：注入碰撞箱显示（chair_show）所需的渲染控制器条件与缩放覆盖。
 */
export function mergeChairEntity(innerPackEntity: ChairEntityFile): ChairEntityFile {
  const descA = innerPackEntity?.['minecraft:client_entity']?.description;
  const descB = CHAIR_ENTITY_DEF_BASIC['minecraft:client_entity'].description as ChairEntityDescription;

  if (!descA) {
    throw new Error('内置包 chair.entity.json 缺少 minecraft:client_entity.description');
  }

  const scripts = cloneJson(descA.scripts) ?? {};
  const preAnimation = Array.isArray(scripts.pre_animation) ? [...scripts.pre_animation] : [];
  if (!preAnimation.includes(HITBOX_SCALE_OVERRIDE)) {
    preAnimation.push(HITBOX_SCALE_OVERRIDE);
  }
  scripts.pre_animation = preAnimation;

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
    // 使用内置包（A），并追加碰撞箱缩放覆盖
    scripts,
    animations: cloneJson(descA.animations),
    render_controllers: buildChairRenderControllers(descA.render_controllers),
  };

  return {
    format_version: innerPackEntity.format_version ?? CHAIR_ENTITY_DEF_BASIC.format_version,
    'minecraft:client_entity': {
      description: mergedDescription,
    },
  };
}
