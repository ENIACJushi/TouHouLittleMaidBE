import {
  PositionChannel,
  RotationChannel,
  ScaleChannel,
} from "../types/AnimationSchema180";
import {AnimationTypes} from "../types/AnimationTypes";
import {APUtils} from "./APUtils";
import {bakeCatmullRomChannelToLinear} from "./APCatmullRomBake";

/**
 * 行走动画处理
 */
export const data = {
  types: [
    AnimationTypes.walk,
  ],
  func: async ({ animation }) => {
    if (animation.bones) {
      for (let boneName in animation.bones) {
        let bone = animation.bones[boneName];
        multiply(bone.position);
        multiply(bone.rotation);
        multiply(bone.scale, true);
      }
    }
    return;
  }
};

type AnimationChannel = PositionChannel | RotationChannel | ScaleChannel | undefined;

function multiply(data: AnimationChannel, isScale?: boolean) {
  if (!data) return;

  // 先把 catmullrom 烘焙为线性 vec3，再乘 walk_process（逻辑与原先一致）
  // 全局 APCatmullRomBake 会再跑一遍，对已是线性的通道为 no-op
  bakeCatmullRomChannelToLinear(data);

  APUtils.forEachMolangOfChannel(data, (value) => {
    if (value === 0) {
      return value;
    }
    if (isScale) {
      return `(v.walk_process > 0.2) ? (${value}) : 1`;
    }
    return `v.walk_process*(${value})`;
  });
}
