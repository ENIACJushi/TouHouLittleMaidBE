import {
  AnimationDefinition180,
  Molang,
  PositionChannel,
  RotationChannel,
  ScaleChannel,
  Vec3KeyframeValue
} from "../types/AnimationSchema180";
import {AnimationTypes} from "../types/AnimationTypes";

/**
 * 行走动画处理
 */
export const data = {
  types: [
    AnimationTypes.walk,
  ],
  func: async (animation: AnimationDefinition180) => {
    if (animation.bones) {
      for (let boneName in animation.bones) {
        let bone = animation.bones[boneName];
        multiply(bone.position);
        multiply(bone.rotation);
        multiply(bone.scale);
      }
    }
    return;
  }
};

type AnimationChannel = PositionChannel | RotationChannel | ScaleChannel | undefined;

function multiply(data: AnimationChannel) {
  if (!data) return;

  const processArr = (arr: Molang[]) => {
    arr.forEach((value, index) => {
      if (value !== 0) {
        // 不等于 0 才需要乘
        arr[index] = `v.walk_process*(${value})`;
      }
    });
  };

  const processKeyframeValue = (value: Vec3KeyframeValue) => {
    if (Array.isArray(value)) {
      processArr(value as Molang[]);
      return;
    }

    // 只处理 pre，post 为插值结果，不应注入变量
    if (value.pre && Array.isArray(value.pre)) {
      processArr(value.pre as Molang[]);
    }
  };

  if (Array.isArray(data)) {
    if (data.length === 3) {
      processArr(data as Molang[]);
    }
    return;
  }

  if (typeof data === "object") {
    Object.values(data).forEach((value) => {
      if (Array.isArray(value)) {
        processArr(value as Molang[]);
      } else if (value && typeof value === "object") {
        processKeyframeValue(value as Vec3KeyframeValue);
      }
    });
  }
}
