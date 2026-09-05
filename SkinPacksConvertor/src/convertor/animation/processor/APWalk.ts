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

  // 必须先强制烘焙 catmullrom，再乘 walk_process；否则样条通道混入 Molang 会触发基岩预计算报错
  // （全局 APCatmullRomBake 对纯常量通道会保留样条，故此处 force）
  bakeCatmullRomChannelToLinear(data, {force: true});

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
