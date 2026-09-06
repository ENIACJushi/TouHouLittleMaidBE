import {AnimationDefinition180, Molang, PositionChannel} from '../animation/types/AnimationSchema180';
import {MaidAnimationListSchema180} from '../animation/types/MaidAnimationFileSchema180';
import {getDynamicMolangVariableDefaults} from '../molang/v/VariableResolvers';
import {APUtils} from '../animation/processor/APUtils';
import {isAnimationEmpty} from './YsmLocomotionResolver';
import {toYsmRoamingKeepField} from './roaming/YsmRoamingFields';

const TAG = 'adaptYsmSitAnimation';

/**
 * YSM→女仆贴地坐下的目标下压量（模型空间像素）。
 * 对齐内置 gecko 常见量级（酒狐 Root≈-14；默认 sit 约 Root-5+AllBody-10.5）。
 */
export const YSM_SIT_TARGET_LOWER_Y = 14;

/** 无轮盘 min 时，`sitheight` 类变量的缺省下压 */
export const YSM_SITHEIGHT_DEFAULT = -8;

/** 优先在这些骨骼的 position.y 上补下压（先命中先写） */
const LOWER_BONE_CANDIDATES = ['Root', 'root', 'AllBody', 'All', 'all'] as const;

/** 视为「坐下高度」轮盘/变量的叶子名 */
const SITHEIGHT_LEAF_RE = /sitheight|sit_height/i;

/**
 * 对动画表中的 sit / sit2 / … 做 YSM 贴地适配（原地修改）。
 * 应在 {@link fillEmptyCanonicalClips} 之后、导出处理之前调用。
 */
export function adaptYsmSitClips(animations: MaidAnimationListSchema180): number {
  let adapted = 0;
  for (const [name, anim] of Object.entries(animations)) {
    if (!/^sit/i.test(name)) {
      continue;
    }
    if (!anim || isAnimationEmpty(anim)) {
      continue;
    }
    if (adaptYsmSitAnimation(anim)) {
      adapted++;
      console.log(TAG, `已适配坐下 clip: ${name}`);
    }
  }
  return adapted;
}

/**
 * 补足单条坐下动画的垂直下压，使 Root/AllBody 合计接近 {@link YSM_SIT_TARGET_LOWER_Y}。
 * @returns 是否发生了修改
 */
export function adaptYsmSitAnimation(animation: AnimationDefinition180): boolean {
  if (!animation.bones) {
    animation.bones = {};
  }

  const currentDown = estimateSitDownwardY(animation);
  const deficit = YSM_SIT_TARGET_LOWER_Y - currentDown;
  if (deficit <= 0.5) {
    return false;
  }

  const boneName = pickLowerBone(animation) ?? 'Root';
  if (!animation.bones[boneName]) {
    animation.bones[boneName] = {};
  }
  const bone = animation.bones[boneName];
  if (!bone.position) {
    bone.position = [0, -deficit, 0];
    return true;
  }

  addPositionY(bone.position, -deficit);
  return true;
}

/**
 * 估算坐下姿态已有的下压量（正数=向下）。
 * 含：Root/AllBody 等数值 Y，以及 `sitheight` 类 roaming 的登记默认值。
 */
export function estimateSitDownwardY(animation: AnimationDefinition180): number {
  let down = 0;
  const bones = animation.bones ?? {};
  let countedSitheight = false;

  for (const name of LOWER_BONE_CANDIDATES) {
    const pos = bones[name]?.position;
    if (!pos) {
      continue;
    }
    for (const y of collectPositionYValues(pos)) {
      if (typeof y === 'number') {
        if (y < 0) {
          down += -y;
        }
        continue;
      }
      if (typeof y === 'string' && isSitheightExpr(y) && !countedSitheight) {
        countedSitheight = true;
        const def = resolveSitheightDefault();
        if (def < 0) {
          down += -def;
        }
      }
    }
  }

  return down;
}

/** 从轮盘表单推断 sitheight 默认值：优先用负向 min，否则 {@link YSM_SITHEIGHT_DEFAULT} */
export function sitheightDefaultFromForm(min?: number, max?: number): number {
  if (typeof min === 'number' && Number.isFinite(min) && min < 0) {
    return min;
  }
  if (typeof max === 'number' && Number.isFinite(max) && max < 0) {
    return max;
  }
  return YSM_SITHEIGHT_DEFAULT;
}

/** 字段或标题是否表示「坐下高度」调整 */
export function isSitheightField(leafOrField: string, title = '', description = ''): boolean {
  if (SITHEIGHT_LEAF_RE.test(leafOrField)) {
    return true;
  }
  const label = `${title}${description}`;
  return /坐下高度|sit\s*height/i.test(label);
}

function resolveSitheightDefault(): number {
  const defaults = getDynamicMolangVariableDefaults();
  const field = toYsmRoamingKeepField('sitheight');
  const v = defaults.get(field);
  if (typeof v === 'number' && Number.isFinite(v)) {
    return v;
  }
  // 兼容 sit_height 命名
  const alt = defaults.get(toYsmRoamingKeepField('sit_height'));
  if (typeof alt === 'number' && Number.isFinite(alt)) {
    return alt;
  }
  return YSM_SITHEIGHT_DEFAULT;
}

function pickLowerBone(animation: AnimationDefinition180): string | undefined {
  const bones = animation.bones ?? {};
  for (const name of LOWER_BONE_CANDIDATES) {
    if (bones[name]) {
      return name;
    }
  }
  return undefined;
}

function isSitheightExpr(expr: string): boolean {
  return /roaming\.sit_?height|ysm_roaming_sit_?height/i.test(expr);
}

/** 收集 position 通道里出现的全部 Y 分量（静态向量与关键帧） */
function collectPositionYValues(data: PositionChannel): Molang[] {
  const out: Molang[] = [];
  APUtils.forEachVec3MolangOfChannel(data, (vec3) => {
    out.push(vec3[1]);
  });
  // 标量简写极少见于 position，忽略
  return out;
}

/** 给 position 通道每个 vec3 的 Y 加上 delta（可为负） */
function addPositionY(data: PositionChannel, delta: number): void {
  APUtils.forEachVec3MolangOfChannel(data, (vec3) => {
    vec3[1] = addMolang(vec3[1], delta);
  });
}

function addMolang(value: Molang, delta: number): Molang {
  if (typeof value === 'number') {
    return value + delta;
  }
  if (delta === 0) {
    return value;
  }
  // 字符串 molang：追加常量偏置
  const sign = delta >= 0 ? '+' : '-';
  const abs = Math.abs(delta);
  return `(${value})${sign}${abs}`;
}
