import {AnimationDefinition180, BoneAnimation, Molang, RotationChannel} from '../types/AnimationSchema180';

/**
 * 基岩已有 `look_at_target` 驱动 Head；YSM/Gecko 的 parallel 里常再写一段
 * `ysm.head_pitch` / `query.head_y_rotation` 补偿式（Java 侧抵消渲染器转头）。
 * 两套叠在一起会导致俯仰明显过大。
 *
 * 策略：若 Head/head/AllHead 的 rotation 含注视类 molang，则去掉该通道，
 * 把转头交给 `look_at_target`；静态关键帧（如坐下低头）不受影响。
 */
const HEAD_BONE_NAME_RE = /^(head|allhead)$/i;

/** 注视/头部朝向相关 molang（转换后或源式） */
const LOOK_MOLANG_RE =
  /head_[xy]_rotation|target_[xy]_rotation|ysm\.head_pitch|ysm\.head_yaw/i;

export const data = {
  types: undefined,
  func: async ({animation}) => {
    stripHeadLookChannels(animation);
    if (animation.extractedEyeAnimation) {
      stripHeadLookChannels(animation.extractedEyeAnimation);
    }
  },
};

export function stripHeadLookChannels(animation: AnimationDefinition180): void {
  if (!animation.bones) {
    return;
  }
  for (const [boneName, bone] of Object.entries(animation.bones)) {
    if (!HEAD_BONE_NAME_RE.test(boneName)) {
      continue;
    }
    stripBoneLookRotation(bone);
  }
}

function stripBoneLookRotation(bone: BoneAnimation): void {
  if (bone.rotation === undefined) {
    return;
  }
  if (rotationChannelHasLookMolang(bone.rotation)) {
    delete bone.rotation;
  }
}

function rotationChannelHasLookMolang(channel: RotationChannel): boolean {
  return channelContainsLookMolang(channel);
}

function channelContainsLookMolang(value: unknown): boolean {
  if (typeof value === 'string') {
    return LOOK_MOLANG_RE.test(value);
  }
  if (typeof value === 'number' || value === null || value === undefined) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some((item) => channelContainsLookMolang(item));
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((item) =>
      channelContainsLookMolang(item),
    );
  }
  return false;
}

/** 测试辅助：判断单条 molang 是否算注视驱动 */
export function isLookMolang(molang: Molang): boolean {
  return typeof molang === 'string' && LOOK_MOLANG_RE.test(molang);
}
