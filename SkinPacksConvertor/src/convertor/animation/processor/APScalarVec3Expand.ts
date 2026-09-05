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

/**
 * GeckoLib / Blockbench 允许关键帧简写：`0` ≡ `[0,0,0]`，`{post:0}` ≡ `{post:[0,0,0]}`。
 * 基岩 schema 要求关键帧值为 array 或带 array 型 pre/post 的 object。
 *
 * 须在 APCatmullRomScaleHold / APCatmullRomBake 之前：否则 ScaleHold 对标量 post
 * 做 cloneVec3 会得到 `[null,null,null]`，Bake 也无法数值化标量 catmullrom。
 */
export const data = {
  types: undefined, // 对所有动画均执行
  func: async ({animation}) => {
    expandScalarVec3Bones(animation);
    if (animation.extractedEyeAnimation) {
      expandScalarVec3Bones(animation.extractedEyeAnimation);
    }
  },
};

/** 将动画内所有骨骼通道的关键帧标量简写展开为三元组 */
export function expandScalarVec3Bones(animation: AnimationDefinition180): void {
  if (!animation.bones) {
    return;
  }
  for (const bone of Object.values(animation.bones)) {
    expandScalarVec3Channel(bone.position);
    expandScalarVec3Channel(bone.rotation);
    expandScalarVec3Channel(bone.scale);
  }
}

/**
 * 若通道为关键帧对象，则把标量关键帧 / 标量 pre·post 展开为 `[v,v,v]`。
 * 常量通道（单 molang）与已是 vec3 的数组保持不动。
 */
export function expandScalarVec3Channel(data: AnimationChannel): void {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return;
  }
  const channel = data as Record<string, unknown>;
  for (const time of Object.keys(channel)) {
    channel[time] = expandKeyframeValue(channel[time] as Vec3KeyframeValue | Molang);
  }
}

function expandKeyframeValue(value: Vec3KeyframeValue | Molang): Vec3KeyframeValue {
  // 关键帧标量：`0` / `"1-q.x"` → 三轴同值
  if (typeof value === 'number' || typeof value === 'string') {
    return broadcastScalar(value);
  }
  if (Array.isArray(value)) {
    return value;
  }
  if (!value || typeof value !== 'object') {
    return value as Vec3KeyframeValue;
  }

  // 对象关键帧：`{post:0}` / `{pre:1,post:1}` → pre/post 各展开为三元组
  return expandObjectKeyframePrePost(value);
}

/**
 * 将对象关键帧内标量形式的 `pre` / `post` 展开为 `[v,v,v]`。
 * 已是数组的字段保持不变；`lerp_mode` 等其它字段原样保留。
 */
function expandObjectKeyframePrePost(value: Vec3KeyframeObject): Vec3KeyframeObject {
  const obj = value as Vec3KeyframeObject & {
    pre?: Molang | [Molang, Molang, Molang];
    post?: Molang | [Molang, Molang, Molang];
  };
  if (isScalarMolang(obj.pre)) {
    obj.pre = broadcastScalar(obj.pre);
  }
  if (isScalarMolang(obj.post)) {
    obj.post = broadcastScalar(obj.post);
  }
  return obj as Vec3KeyframeObject;
}

function isScalarMolang(value: unknown): value is Molang {
  return typeof value === 'number' || typeof value === 'string';
}

function broadcastScalar(value: Molang): [Molang, Molang, Molang] {
  return [value, value, value];
}
