import {AnimationDefinition180, BoneAnimation, Molang, RotationChannel} from '../types/AnimationSchema180';

/**
 * Head 注视与通用 `look_at_target` 的协调：
 *
 * 1. **补偿式**（含 `head_x/y_rotation`）：Java 侧抵消渲染器转头，叠 look_at 会过大 → 删除该 rotation。
 * 2. **驱动式**（仅 target_* 或 ysm.head_pitch|yaw）：睡姿基准+注视、1/4 注视等 → **保留**；
 *    由导出阶段在对应 animate_* 选中时置 v.tlm_custom_head_look=1，关掉 look_at_target。
 * 3. 静态关键帧（无注视 molang）不动。
 */
const HEAD_BONE_NAME_RE = /^(head|allhead)$/i;

/** Java 补偿式残留：应对调的 head_*_rotation（含已补参的 (0)） */
const COMPENSATION_HEAD_QUERY_RE = /head_[xy]_rotation/i;

/** 驱动式注视：基岩 target / YSM head_pitch|yaw */
const HEAD_LOOK_DRIVE_RE =
  /target_[xy]_rotation|ysm\.head_pitch|ysm\.head_yaw/i;

export const data = {
  types: undefined,
  func: async ({animation}) => {
    stripCompensationHeadLook(animation);
    if (animation.extractedEyeAnimation) {
      stripCompensationHeadLook(animation.extractedEyeAnimation);
    }
  },
};

/** 仅剥掉含 head_*_rotation 的 Head 补偿通道 */
export function stripCompensationHeadLook(animation: AnimationDefinition180): void {
  if (!animation.bones) {
    return;
  }
  for (const [boneName, bone] of Object.entries(animation.bones)) {
    if (!HEAD_BONE_NAME_RE.test(boneName)) {
      continue;
    }
    stripCompensationRotation(bone);
  }
}

/**
 * 动画是否仍含「驱动式」Head 注视（应用 AP 后调用）。
 * 为 true 时导出应关闭通用 look_at_target。
 */
export function animationHasCustomHeadLookDrive(
  animation: AnimationDefinition180 | undefined,
): boolean {
  if (!animation?.bones) {
    return false;
  }
  for (const [boneName, bone] of Object.entries(animation.bones)) {
    if (!HEAD_BONE_NAME_RE.test(boneName)) {
      continue;
    }
    if (bone.rotation !== undefined && channelContains(bone.rotation, HEAD_LOOK_DRIVE_RE)) {
      return true;
    }
  }
  return false;
}

function stripCompensationRotation(bone: BoneAnimation): void {
  if (bone.rotation === undefined) {
    return;
  }
  if (channelContains(bone.rotation, COMPENSATION_HEAD_QUERY_RE)) {
    delete bone.rotation;
  }
}

function channelContains(value: unknown, re: RegExp): boolean {
  if (typeof value === 'string') {
    return re.test(value);
  }
  if (typeof value === 'number' || value === null || value === undefined) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some((item) => channelContains(item, re));
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((item) =>
      channelContains(item, re),
    );
  }
  return false;
}

/** @deprecated 兼容旧单测命名 */
export function stripHeadLookChannels(animation: AnimationDefinition180): void {
  stripCompensationHeadLook(animation);
}

/** 测试辅助 */
export function isLookMolang(molang: Molang): boolean {
  return typeof molang === 'string'
    && (COMPENSATION_HEAD_QUERY_RE.test(molang) || HEAD_LOOK_DRIVE_RE.test(molang));
}

export function isCompensationHeadLookMolang(molang: Molang): boolean {
  return typeof molang === 'string' && COMPENSATION_HEAD_QUERY_RE.test(molang);
}
