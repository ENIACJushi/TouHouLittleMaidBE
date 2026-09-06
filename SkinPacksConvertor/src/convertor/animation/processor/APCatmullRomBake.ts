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
type ChannelEntry = {time: string; numTime: number; value: Vec3KeyframeValue};

/** 烘焙选项 */
export type BakeCatmullRomOptions = {
  /** 即使全常量也烘焙（walk 注入 Molang 前必须先去样条） */
  force?: boolean;
  /**
   * 是否循环动画。未传时由 animation.loop===true 推断。
   * 基岩循环 catmullrom 接缝不环绕，每圈会卡一下，故循环纯常量也需烘焙。
   */
  loop?: boolean;
};

/**
 * 不指定 types：注册到全部 AnimationTypes。
 * 须在 APCatmullRomScaleHold 之后：先补 catmullrom 末帧 hold，再处理样条。
 *
 * - 含 Molang：去掉 catmullrom，避免预计算报错
 * - 循环纯常量：环绕烘焙为线性（修接缝卡顿，且保留原关键帧峰值）
 * - 非循环纯常量：保留原生样条（眨眼等短关键帧靠 Hold 稳住）
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
 * 按骨骼通道处理 catmullrom。
 *
 * 基岩对 catmullrom（cubic）会做预计算，要求通道内关键帧均为常量；
 * 一旦同通道混入 Molang（如雨天分支），会报：
 * 「Precomputed cubic interpolation requires keyframes have constant data」。
 * 另：`loop:true` 时样条邻域不环绕，接缝易每圈卡一下。
 */
export function bakeCatmullRomBones(
  animation: AnimationDefinition180,
  options?: BakeCatmullRomOptions,
): void {
  if (!animation.bones) {
    return;
  }
  const resolved: BakeCatmullRomOptions = {
    ...options,
    loop: options?.loop ?? animation.loop === true,
  };
  for (const bone of Object.values(animation.bones)) {
    bakeCatmullRomChannelToLinear(bone.position, resolved);
    bakeCatmullRomChannelToLinear(bone.rotation, resolved);
    bakeCatmullRomChannelToLinear(bone.scale, resolved);
  }
}

/** 若通道为关键帧对象，则按策略把 catmullrom 烘焙成线性 vec3（原地修改） */
export function bakeCatmullRomChannelToLinear(
  data: AnimationChannel,
  options?: BakeCatmullRomOptions,
): void {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    normalizeKeyframeChannel(
      data as Record<string, Vec3KeyframeValue>,
      options?.force === true,
      options?.loop === true,
    );
  }
}

function normalizeKeyframeChannel(
  channel: Record<string, Vec3KeyframeValue>,
  force: boolean,
  loop: boolean,
) {
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

  const hasMolang = entries.some((e) => keyframeHasMolang(e.value));

  // 非循环纯常量：保留原生样条（眨眼短轨 + Hold 已够用）
  if (!force && !hasMolang && !loop) {
    return;
  }

  // 全通道可数值化时走环绕友好烘焙；否则降级去掉 lerp_mode
  if (!hasMolang && canBakeAllNumeric(entries)) {
    bakeNumericCatmullRomChannel(channel, entries, loop);
    return;
  }

  stripCatmullRomToLinear(channel, entries);
}

/** 是否所有关键帧都能取出数值 vec3（可做样条采样） */
function canBakeAllNumeric(entries: ChannelEntry[]): boolean {
  return entries.every((entry) => {
    const base = Array.isArray(entry.value)
      ? entry.value as Vec3
      : pickObjectVec3(entry.value as Vec3KeyframeObject);
    return !!base && !!toNumVec3(base);
  });
}

/**
 * 数值 catmullrom → 线性：保留原关键帧值，段内按样条插密点。
 * loop 时邻域环绕（首尾同值则按闭合轨处理），避免接缝切线断裂。
 */
function bakeNumericCatmullRomChannel(
  channel: Record<string, Vec3KeyframeValue>,
  entries: ChannelEntry[],
  loop: boolean,
) {
  const bases = entries.map((entry) => {
    const base = Array.isArray(entry.value)
      ? entry.value as Vec3
      : pickObjectVec3(entry.value as Vec3KeyframeObject)!;
    return toNumVec3(base)!;
  });

  const closed = loop && isClosedDuplicate(bases);
  const normalized: Record<string, Vec3KeyframeValue> = {};

  for (let i = 0; i < entries.length; i++) {
    // 必须保留原关键帧峰值，旧实现用中点均值覆盖会导致中段平台、摇晃变卡
    normalized[entries[i].time] = [...bases[i]] as Vec3;

    if (i >= entries.length - 1) {
      continue;
    }

    const p0 = sampleBase(bases, i - 1, loop, closed);
    const p1 = bases[i];
    const p2 = bases[i + 1];
    const p3 = sampleBase(bases, i + 2, loop, closed);
    const t0 = entries[i].numTime;
    const t1 = entries[i + 1].numTime;

    // 段内 1/4、1/2、3/4 采样，比单中点更接近原样条
    for (const u of [0.25, 0.5, 0.75]) {
      putIfAbsent(normalized, t0 + (t1 - t0) * u, catmullRom(p0, p1, p2, p3, u));
    }
  }

  writeChannel(channel, normalized);
}

/** 含 Molang 或无法数值化：去掉 catmullrom，尽量保留 vec3 */
function stripCatmullRomToLinear(
  channel: Record<string, Vec3KeyframeValue>,
  entries: ChannelEntry[],
) {
  const normalized: Record<string, Vec3KeyframeValue> = {};

  for (const entry of entries) {
    const {time, value} = entry;
    if (Array.isArray(value)) {
      normalized[time] = [...value] as Vec3;
      continue;
    }

    const mode = value.lerp_mode ?? 'linear';
    if (mode === 'linear') {
      const linearValue = pickPostVec3(value) ?? pickObjectVec3(value);
      if (linearValue) {
        normalized[time] = [...linearValue] as Vec3;
      }
      continue;
    }

    const currentBase = pickObjectVec3(value);
    if (currentBase) {
      normalized[time] = [...currentBase] as Vec3;
      continue;
    }

    const {lerp_mode: _removed, ...rest} = value;
    normalized[time] = Object.keys(rest).length ? rest : value;
  }

  writeChannel(channel, normalized);
}

function writeChannel(
  channel: Record<string, Vec3KeyframeValue>,
  normalized: Record<string, Vec3KeyframeValue>,
) {
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

function isClosedDuplicate(bases: NumVec3[]): boolean {
  if (bases.length < 2) {
    return false;
  }
  const a = bases[0];
  const b = bases[bases.length - 1];
  return (
    Math.abs(a[0] - b[0]) < 1e-4
    && Math.abs(a[1] - b[1]) < 1e-4
    && Math.abs(a[2] - b[2]) < 1e-4
  );
}

/** 取邻域控制点；loop+闭合轨时在「去重末帧」的周期内环绕 */
function sampleBase(
  bases: NumVec3[],
  index: number,
  loop: boolean,
  closed: boolean,
): NumVec3 {
  const n = bases.length;
  if (!loop) {
    const clamped = Math.max(0, Math.min(n - 1, index));
    return bases[clamped];
  }
  if (closed && n >= 2) {
    const period = n - 1;
    let i = index;
    // 末帧与首帧同值，读值时映射到 0
    if (i === n - 1) {
      i = 0;
    }
    i = ((i % period) + period) % period;
    return bases[i];
  }
  return bases[((index % n) + n) % n];
}

/** 关键帧是否含非数值 Molang（字符串表达式） */
function keyframeHasMolang(value: Vec3KeyframeValue): boolean {
  if (Array.isArray(value)) {
    return vec3HasMolang(value as Vec3);
  }
  if (!value || typeof value !== 'object') {
    return false;
  }
  const obj = value as Vec3KeyframeObject & {post?: Molang | Vec3; pre?: Molang | Vec3};
  return molangOrVec3HasMolang(obj.post) || molangOrVec3HasMolang(obj.pre);
}

function molangOrVec3HasMolang(value: Molang | Vec3 | undefined): boolean {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === 'string') {
    return true;
  }
  if (Array.isArray(value)) {
    return vec3HasMolang(value as Vec3);
  }
  return false;
}

function vec3HasMolang(value: Vec3): boolean {
  return value.some((c) => typeof c === 'string');
}

function pickPostVec3(value: Vec3KeyframeObject): Vec3 | undefined {
  return coerceToVec3((value as Vec3KeyframeObject & {post?: Molang | Vec3}).post);
}

function pickObjectVec3(value: Vec3KeyframeObject): Vec3 | undefined {
  return pickPostVec3(value)
    ?? coerceToVec3((value as Vec3KeyframeObject & {pre?: Molang | Vec3}).pre);
}

/** 数组三元组原样返回；Gecko 标量简写广播为 `[v,v,v]` */
function coerceToVec3(value: Molang | Vec3 | undefined): Vec3 | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'number' || typeof value === 'string') {
    return [value, value, value];
  }
  if (Array.isArray(value) && value.length === 3) {
    return value;
  }
  return undefined;
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
