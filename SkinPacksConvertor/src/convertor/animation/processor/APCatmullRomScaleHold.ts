import {
  AnimationDefinition180,
  Molang,
  PositionChannel,
  RotationChannel,
  ScaleChannel,
  Vec3KeyframeValue,
} from '../types/AnimationSchema180';

/** 判定「已有末帧 / 已贴近 animation_length」的时间容差 */
const TIME_EPS = 1e-4;

type KeyframeChannel = PositionChannel | RotationChannel | ScaleChannel | undefined;
type NumVec3 = [Molang, Molang, Molang];

/**
 * 基岩 catmullrom：末关键帧到 animation_length 之间若无下一控制点，
 * scale 常会插向 0（眼皮消失），position/rotation 也会漂移（如眼睑上移到眉）。
 * Java/GeckoLib 会 hold 末帧；此处对含 catmullrom 的通道在 animation_length 补 hold。
 *
 * 与「纯常量样条保留、不强制烘焙」配合：短眨眼关键帧 + 长 animation_length 必须靠 hold 稳住空档。
 */
/** 不指定 types：注册到全部 AnimationTypes */
export const data = {
  types: undefined, // 对所有动画均执行
  func: async ({animation}) => {
    padCatmullRomScaleHold(animation);
    if (animation.extractedEyeAnimation) {
      padCatmullRomScaleHold(animation.extractedEyeAnimation);
    }
  },
};

/**
 * 对动画内所有骨骼的 catmullrom 通道（scale / position / rotation）
 * 在 animation_length 补 hold 末帧。
 * 函数名保留 ScaleHold 以兼容既有调用与单测。
 */
export function padCatmullRomScaleHold(animation: AnimationDefinition180): void {
  const length = animation.animation_length;
  if (typeof length !== 'number' || !Number.isFinite(length) || length <= 0) {
    return;
  }
  if (!animation.bones) {
    return;
  }
  for (const bone of Object.values(animation.bones)) {
    // scale 缺省恒等为 1；位姿缺省为 0
    padCatmullRomChannel(bone.scale, length, [1, 1, 1]);
    padCatmullRomChannel(bone.position, length, [0, 0, 0]);
    padCatmullRomChannel(bone.rotation, length, [0, 0, 0]);
  }
}

function padCatmullRomChannel(
  channel: KeyframeChannel,
  animationLength: number,
  missingDefault: NumVec3,
): void {
  if (!isKeyframeChannel(channel)) {
    return;
  }
  if (!channelHasCatmullRom(channel)) {
    return;
  }

  const times = getNumericKeyframeTimes(channel);
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
  channel[lengthKey] = cloneAsCatmullRomHold(channel[last.time], missingDefault);
}

function isKeyframeChannel(
  channel: KeyframeChannel,
): channel is Record<string, Vec3KeyframeValue> {
  if (channel === undefined || channel === null) {
    return false;
  }
  if (typeof channel === 'string' || typeof channel === 'number') {
    return false;
  }
  if (Array.isArray(channel)) {
    return false;
  }
  return typeof channel === 'object';
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
function cloneAsCatmullRomHold(
  last: Vec3KeyframeValue,
  missingDefault: NumVec3,
): Vec3KeyframeValue {
  if (Array.isArray(last)) {
    return {
      post: cloneAsVec3(last),
      lerp_mode: 'catmullrom',
    };
  }
  const source = last.post ?? last.pre;
  if (source === undefined || source === null) {
    return {
      post: [...missingDefault] as NumVec3,
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
