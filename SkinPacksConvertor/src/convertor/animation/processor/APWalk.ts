import {AnimationDefinition180, Molang, PositionChannel, Vec3KeyframeValue} from "../types/AnimationSchema180";
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

function multiply(data: Molang[] | any) {
  const processArr = (data: Molang[]) => {
    data.forEach((value, index) => {
      if (value !== 0) {
        // 不等于 0 才需要乘
        data[index] = `v.walk_process*(${value})`;
      }
    });
  };

  if (Array.isArray(data)) {
    processArr(data);
  } else if (data && typeof data === "object") {
    // Record<string, [Molang, Molang, Molang]>
    Object.values(data).forEach((value) => {
      if (Array.isArray(value)) {
        processArr(value as Molang[]);
      }
    });
  }
}
