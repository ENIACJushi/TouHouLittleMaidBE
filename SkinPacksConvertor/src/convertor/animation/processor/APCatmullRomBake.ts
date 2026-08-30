import {
  AnimationDefinition180,
  Molang,
  PositionChannel,
  RotationChannel,
  ScaleChannel,
  Vec3KeyframeObject,
  Vec3KeyframeValue,
} from '../types/AnimationSchema180';

type AnimationChannel = PositionChannel | RotationChannel | ScaleChannel | undefined;
type Vec3 = [Molang, Molang, Molang];
type NumVec3 = [number, number, number];

const EPSILON_TIME = 1e-4;

/**
 * 不指定 types：注册到全部 AnimationTypes。
 * 须在 APCatmullRomScaleHold 之后：先补 scale 末帧，再去掉全部 catmullrom，
 * 避免「catmullrom + Molang」触发基岩预计算报错，同时保留 hold 关键帧数值。
 */
export const data = {
  types: undefined, // 对所有动画均执行
  func: async ({animation}) => {
    bakeCatmullRomBones(animation);
    if (animation.extractedEyeAnimation) {
      bakeCatmullRomBones(animation.extractedEyeAnimation);
    }
  },
};

/**
 * 将动画内所有骨骼通道的 catmullrom 烘焙为普通 vec3 关键帧。
 *
 * 基岩对 catmullrom（cubic）会做预计算，要求通道内关键帧均为常量；
 * 一旦同通道混入 Molang（如雨天分支），会报：
 * 「Precomputed cubic interpolation requires keyframes have constant data」。
 * 另：循环样条缺控制点时也容易在末帧卡死；walk 已用此法，idle 等同理。
 */
export function bakeCatmullRomBones(animation: AnimationDefinition180): void {
  if (!animation.bones) {
    return;
  }
  for (const bone of Object.values(animation.bones)) {
    bakeCatmullRomChannelToLinear(bone.position);
    bakeCatmullRomChannelToLinear(bone.rotation);
    bakeCatmullRomChannelToLinear(bone.scale);
  }
}

/** 若通道为关键帧对象，则把 catmullrom 烘焙成线性 vec3（原地修改） */
export function bakeCatmullRomChannelToLinear(data: AnimationChannel): void {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    normalizeKeyframeChannel(data as Record<string, Vec3KeyframeValue>);
  }
}

function normalizeKeyframeChannel(channel: Record<string, Vec3KeyframeValue>) {
  const entries = Object.entries(channel)
    .map(([time, value]) => ({time, numTime: Number(time), value}))
    .filter((item) => Number.isFinite(item.numTime))
    .sort((a, b) => a.numTime - b.numTime);

  if (!entries.length) {
    return;
  }

  // 通道内没有任何 catmullrom 时直接跳过，避免无谓改写 linear 对象关键帧
  const hasCatmull = entries.some(
    (e) => !Array.isArray(e.value) && e.value?.lerp_mode === 'catmullrom',
  );
  if (!hasCatmull) {
    return;
  }

  const normalized: Record<string, Vec3KeyframeValue> = {};

  entries.forEach((entry, index) => {
    const {time, numTime, value} = entry;

    // 普通 vec3 关键帧
    if (Array.isArray(value)) {
      normalized[time] = [...value] as Vec3;
      return;
    }

    const mode = value.lerp_mode ?? 'linear';

    if (mode === 'linear') {
      const linearValue = pickPostVec3(value) ?? pickObjectVec3(value);
      if (linearValue) {
        normalized[time] = [...linearValue] as Vec3;
      }
      return;
    }

    // catmullrom：能数值化则烘焙平滑点；含 Molang 则降为线性 vec3（去掉 lerp_mode）
    const currentBase = pickObjectVec3(value);
    if (!currentBase) {
      // 无法取到 pre/post 时保留原对象但去掉 catmullrom，避免引擎预计算失败
      const {lerp_mode: _removed, ...rest} = value;
      normalized[time] = Object.keys(rest).length ? rest : value;
      return;
    }

    const prevBase = getNeighborBase(entries, index - 1) ?? currentBase;
    const nextBase = getNeighborBase(entries, index + 1) ?? currentBase;

    const prevNum = toNumVec3(prevBase);
    const currNum = toNumVec3(currentBase);
    const nextNum = toNumVec3(nextBase);

    if (!prevNum || !currNum || !nextNum) {
      normalized[time] = [...currentBase] as Vec3;
      return;
    }

    const prev2Base = getNeighborBase(entries, index - 2) ?? prevBase;
    const next2Base = getNeighborBase(entries, index + 2) ?? nextBase;
    const prev2Num = toNumVec3(prev2Base) ?? prevNum;
    const next2Num = toNumVec3(next2Base) ?? nextNum;

    const beforeValue = catmullRom(prev2Num, prevNum, currNum, nextNum, 0.5);
    const afterValue = catmullRom(prevNum, currNum, nextNum, next2Num, 0.5);
    normalized[time] = [
      (beforeValue[0] + afterValue[0]) / 2,
      (beforeValue[1] + afterValue[1]) / 2,
      (beforeValue[2] + afterValue[2]) / 2,
    ];

    const prevTime = index > 0 ? entries[index - 1].numTime : undefined;
    const nextTime = index < entries.length - 1 ? entries[index + 1].numTime : undefined;

    const beforeTime = prevTime !== undefined ? (prevTime + numTime) / 2 : Math.max(0, numTime - EPSILON_TIME);
    const afterTime = nextTime !== undefined ? (numTime + nextTime) / 2 : numTime + EPSILON_TIME;

    putIfAbsent(normalized, beforeTime, beforeValue);
    putIfAbsent(normalized, Math.max(0, afterTime), afterValue);
  });

  // 保留无法解析时间键的原始条目
  Object.entries(channel).forEach(([time, value]) => {
    if (!Number.isFinite(Number(time))) {
      normalized[time] = value;
    }
  });

  Object.keys(channel).forEach((key) => delete channel[key]);

  Object.entries(normalized)
    .sort((a, b) => {
      const ta = Number(a[0]);
      const tb = Number(b[0]);
      if (Number.isFinite(ta) && Number.isFinite(tb)) {
        return ta - tb;
      }
      if (Number.isFinite(ta)) {
        return -1;
      }
      if (Number.isFinite(tb)) {
        return 1;
      }
      return a[0].localeCompare(b[0]);
    })
    .forEach(([k, v]) => {
      channel[k] = v;
    });
}

function getNeighborBase(
  entries: Array<{time: string; numTime: number; value: Vec3KeyframeValue}>,
  index: number,
): Vec3 | undefined {
  if (index < 0 || index >= entries.length) {
    return undefined;
  }
  const value = entries[index].value;
  if (Array.isArray(value)) {
    return value as Vec3;
  }
  return pickObjectVec3(value);
}

function pickPostVec3(value: Vec3KeyframeObject): Vec3 | undefined {
  if (value.post && Array.isArray(value.post) && value.post.length === 3) {
    return value.post;
  }
  return undefined;
}

function pickObjectVec3(value: Vec3KeyframeObject): Vec3 | undefined {
  return pickPostVec3(value)
    ?? ((value.pre && Array.isArray(value.pre) && value.pre.length === 3) ? value.pre : undefined);
}

function toNumVec3(value: Vec3): NumVec3 | undefined {
  const [x, y, z] = value;
  if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') {
    return undefined;
  }
  return [x, y, z];
}

function catmullRom(p0: NumVec3, p1: NumVec3, p2: NumVec3, p3: NumVec3, t: number): NumVec3 {
  const t2 = t * t;
  const t3 = t2 * t;

  return [0, 1, 2].map((i) => 0.5 * (
    (2 * p1[i])
    + (-p0[i] + p2[i]) * t
    + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2
    + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3
  )) as NumVec3;
}

function formatTime(time: number): string {
  const fixed = time.toFixed(6);
  return fixed.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

function putIfAbsent(target: Record<string, Vec3KeyframeValue>, time: number, value: NumVec3) {
  let key = formatTime(time);
  if (!(key in target)) {
    target[key] = value;
    return;
  }

  let delta = 1e-6;
  for (let i = 0; i < 16; i++) {
    key = formatTime(time + delta);
    if (!(key in target)) {
      target[key] = value;
      return;
    }
    delta *= 2;
  }
}
