import {
  AnimationDefinition180,
  Molang,
  ScaleChannel,
  Vec3KeyframeValue,
} from '../types/AnimationSchema180';

/** 判定「已有末帧 / 已贴近 animation_length」的时间容差 */
const TIME_EPS = 1e-4;

/**
 * 基岩 catmullrom：末关键帧到 animation_length 之间若无下一控制点，
 * scale 常会插向 0，导致眼皮等骨骼在眨眼空档不可见。
 * Java/GeckoLib 会 hold 末帧；此处对含 catmullrom 的 scale 通道在 animation_length 补 hold。
 */
/** 不指定 types：注册到全部 AnimationTypes */
export const data  = {
  types: undefined, // 对所有动画均执行
  func: async ({animation}) => {
    padCatmullRomScaleHold(animation);
    if (animation.extractedEyeAnimation) {
      padCatmullRomScaleHold(animation.extractedEyeAnimation);
    }
  },
};

/** 对动画内所有骨骼的 catmullrom scale 通道补 animation_length 末帧 */
export function padCatmullRomScaleHold(animation: AnimationDefinition180): void {
  const length = animation.animation_length;
  if (typeof length !== 'number' || !Number.isFinite(length) || length <= 0) {
    return;
  }
  if (!animation.bones) {
    return;
  }
  for (const bone of Object.values(animation.bones)) {
    padScaleChannel(bone.scale, length);
  }
}

function padScaleChannel(scale: ScaleChannel | undefined, animationLength: number): void {
  if (!isKeyframeScaleChannel(scale)) {
    return;
  }
  if (!channelHasCatmullRom(scale)) {
    return;
  }

  const times = getNumericKeyframeTimes(scale);
  if (times.length === 0) {
    return;
  }

  const last = times[times.length - 1];
  // 末帧已覆盖到 animation_length，无需补点
  if (last.num >= animationLength - TIME_EPS) {
    return;
  }
  if (times.some((t) => Math.abs(t.num - animationLength) <= TIME_EPS)) {
    return;
  }

  const lengthKey = formatTimeKey(animationLength);
  scale[lengthKey] = cloneAsCatmullRomHold(scale[last.time]);
}

function isKeyframeScaleChannel(
  scale: ScaleChannel | undefined,
): scale is Record<string, Vec3KeyframeValue> {
  if (scale === undefined || scale === null) {
    return false;
  }
  if (typeof scale === 'string' || typeof scale === 'number') {
    return false;
  }
  if (Array.isArray(scale)) {
    return false;
  }
  return typeof scale === 'object';
}

function channelHasCatmullRom(channel: Record<string, Vec3KeyframeValue>): boolean {
  return Object.values(channel).some(
    (value) => !Array.isArray(value) && value?.lerp_mode === 'catmullrom',
  );
}

function getNumericKeyframeTimes(
  channel: Record<string, Vec3KeyframeValue>,
): Array<{time: string; num: number}> {
  return Object.keys(channel)
    .map((time) => ({time, num: Number(time)}))
    .filter((entry) => Number.isFinite(entry.num))
    .sort((a, b) => a.num - b.num);
}

/** 将末帧值克隆为 animation_length 处的 catmullrom hold */
function cloneAsCatmullRomHold(last: Vec3KeyframeValue): Vec3KeyframeValue {
  if (Array.isArray(last)) {
    return {
      post: cloneAsVec3(last),
      lerp_mode: 'catmullrom',
    };
  }
  const source = last.post ?? last.pre;
  if (source === undefined || source === null) {
    return {
      post: [1, 1, 1],
      lerp_mode: 'catmullrom',
    };
  }
  return {
    // 防御：即便上游未展开，标量 pre/post 也写成三元组，避免 [null,null,null]
    post: cloneAsVec3(source as Molang | [Molang, Molang, Molang] | Molang[]),
    lerp_mode: 'catmullrom',
  };
}

/**
 * 克隆为基岩 vec3；若为 Gecko 标量简写则广播为 `[v,v,v]`。
 */
function cloneAsVec3(
  vec: Molang | [Molang, Molang, Molang] | Molang[],
): [Molang, Molang, Molang] {
  if (typeof vec === 'number' || typeof vec === 'string') {
    return [vec, vec, vec];
  }
  return [vec[0], vec[1], vec[2]];
}

function formatTimeKey(time: number): string {
  if (Number.isInteger(time)) {
    return String(time);
  }
  // 去掉浮点尾噪，保留与原动画相近的精度
  return String(Number(time.toFixed(4)));
}
