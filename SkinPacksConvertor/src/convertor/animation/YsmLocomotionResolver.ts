import {AnimationTypes, getAnimationSourceKey} from './types/AnimationTypes';
import {AnimationDefinition180} from './types/AnimationSchema180';
import {MaidAnimationListSchema180} from './types/MaidAnimationFileSchema180';

const TAG = 'YsmLocomotionResolver';

/**
 * 当规范键（walk/idle/…）为空桩时的启发式后备名。
 * 参考 YSM 常见 Blockbench 命名与 `.ref/koishi` / wine_fox 样例。
 */
const HEURISTIC_FALLBACKS: Partial<Record<AnimationTypes, readonly string[]>> = {
  [AnimationTypes.walk]: [
    'walk1front',
    'walk1back',
    'walk2',
    'walk#',
    'walk_slow',
    'walk1',
    'walk_1',
  ],
  [AnimationTypes.idle]: [
    'idle_1',
    'idle_2',
    'idle1',
    'idle2',
    'new_idle_1',
    'new_idle_2',
  ],
  [AnimationTypes.sit]: ['sit2', 'sit3', 'sit_1'],
  [AnimationTypes.beg]: ['beg_1'],
};

/**
 * 优先从这些控制器槽读取状态→clip 映射（与 YSM Hybrid 槽位一致）。
 * pre_main 常承载真实行走/待机；post_main 多为额外 idle 变体。
 */
const LOCOMOTION_CONTROLLER_PRIORITY = [
  'player.pre_main',
  'player.main',
  'player.post_main',
] as const;

/** Bedrock animation_controllers 文件（YSM 包内） */
export interface YsmAnimationControllerFile {
  format_version?: string;
  animation_controllers?: Record<string, YsmAnimationController>;
}

export interface YsmAnimationController {
  initial_state?: string;
  states?: Record<string, YsmControllerState>;
}

export interface YsmControllerState {
  animations?: Array<string | Record<string, string>>;
  transitions?: unknown[];
  on_entry?: string[];
  on_exit?: string[];
  blend_transition?: unknown;
}

/**
 * 状态名 → 候选 clip 名（已按控制器优先级合并，先到先得）。
 * 状态名通常与 AnimationTypes / ctrl.* 一致，如 walk、idle、run。
 */
export type ControllerClipHints = Map<string, string[]>;

/**
 * 判断动画 clip 是否为空桩（无骨骼/粒子/音效/时间线内容）。
 * 对齐 YSM `Animation.isEmpty()`：空桩可被控制器选中但不产生姿态。
 */
export function isAnimationEmpty(anim: AnimationDefinition180 | undefined | null): boolean {
  if (!anim) {
    return true;
  }
  const bones = anim.bones;
  if (bones && Object.keys(bones).length > 0) {
    return false;
  }
  if (anim.particle_effects && Object.keys(anim.particle_effects).length > 0) {
    return false;
  }
  if (anim.sound_effects && Object.keys(anim.sound_effects).length > 0) {
    return false;
  }
  const timeline = anim.timeline;
  if (timeline) {
    for (const value of Object.values(timeline)) {
      if (typeof value === 'string' && value.trim()) {
        return false;
      }
      if (Array.isArray(value) && value.some((s) => String(s).trim())) {
        return false;
      }
    }
  }
  return true;
}

/**
 * 从 YSM `animation_controllers` JSON 提取 locomotion 状态的 clip 候选列表。
 */
export function buildControllerClipHints(
  files: YsmAnimationControllerFile[],
): ControllerClipHints {
  const hints: ControllerClipHints = new Map();
  const mergedControllers: Record<string, YsmAnimationController> = {};

  for (const file of files) {
    const map = file.animation_controllers ?? {};
    for (const [name, ctrl] of Object.entries(map)) {
      // 同名控制器后文件覆盖（与包内多文件合并行为接近）
      mergedControllers[name] = ctrl;
    }
  }

  for (const controllerName of LOCOMOTION_CONTROLLER_PRIORITY) {
    const ctrl = mergedControllers[controllerName];
    if (!ctrl?.states) {
      continue;
    }
    for (const [stateName, state] of Object.entries(ctrl.states)) {
      if (hints.has(stateName)) {
        continue;
      }
      const clips = extractStateAnimationNames(state.animations);
      if (clips.length > 0) {
        hints.set(stateName, clips);
      }
    }
  }

  return hints;
}

/**
 * 解析 state.animations 中的 clip 名（保持声明顺序）。
 */
export function extractStateAnimationNames(
  animations: YsmControllerState['animations'],
): string[] {
  if (!animations || animations.length === 0) {
    return [];
  }
  const names: string[] = [];
  for (const entry of animations) {
    if (typeof entry === 'string') {
      if (entry) {
        names.push(entry);
      }
      continue;
    }
    if (entry && typeof entry === 'object') {
      for (const name of Object.keys(entry)) {
        if (name) {
          names.push(name);
        }
      }
    }
  }
  return names;
}

/**
 * 为 AnimationTypes 解析实际可用的源 clip 键。
 * 顺序：规范键非空 → 控制器状态候选 → 启发式后备名。
 */
export function resolveLocomotionSourceKey(
  type: AnimationTypes,
  animations: MaidAnimationListSchema180,
  hints?: ControllerClipHints,
): string | undefined {
  const canonical = getAnimationSourceKey(type);
  const canonicalAnim = animations[canonical];
  if (canonicalAnim && !isAnimationEmpty(canonicalAnim)) {
    return canonical;
  }

  const candidates: string[] = [];
  // 控制器状态名通常等于枚举值（walk/idle/sit…）
  const fromCtrl = hints?.get(type) ?? hints?.get(canonical);
  if (fromCtrl) {
    candidates.push(...fromCtrl);
  }
  const heuristic = HEURISTIC_FALLBACKS[type];
  if (heuristic) {
    candidates.push(...heuristic);
  }

  const seen = new Set<string>();
  for (const name of candidates) {
    if (!name || seen.has(name) || name === canonical) {
      continue;
    }
    seen.add(name);
    const anim = animations[name];
    if (anim && !isAnimationEmpty(anim)) {
      return name;
    }
  }

  return undefined;
}

/**
 * 将空的规范键（walk/idle/…）用解析到的真实 clip 深拷贝填入。
 * 原地修改 `animations`，便于后续 MaidAnimationConvertor 按规范键导出。
 *
 * @returns 实际填充的类型 → 来源键
 */
export function fillEmptyCanonicalClips(
  animations: MaidAnimationListSchema180,
  hints?: ControllerClipHints,
): Map<AnimationTypes, string> {
  const filled = new Map<AnimationTypes, string>();

  for (const type of Object.values(AnimationTypes) as AnimationTypes[]) {
    const canonical = getAnimationSourceKey(type);
    const current = animations[canonical];
    if (current && !isAnimationEmpty(current)) {
      continue;
    }

    const resolvedKey = resolveLocomotionSourceKey(type, animations, hints);
    if (!resolvedKey || resolvedKey === canonical) {
      continue;
    }
    const source = animations[resolvedKey];
    if (!source || isAnimationEmpty(source)) {
      continue;
    }

    animations[canonical] = JSON.parse(JSON.stringify(source)) as AnimationDefinition180;
    filled.set(type, resolvedKey);
    console.log(TAG, `填充空桩 ${canonical} ← ${resolvedKey}`);
  }

  return filled;
}
