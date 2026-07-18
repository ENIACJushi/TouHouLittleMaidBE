import { AnimationProcessor } from "./AnimationProcessor";
import { AnimationTypes } from "../types/AnimationTypes";
import { AnimationDefinition180 } from "../types/AnimationSchema180";

/**
 * 行走动画处理
 */
export const APWalk = async (animation: AnimationDefinition180) => {
  if (animation.bones) {
    for (let boneName in animation.bones) {
      let bone = animation.bones[boneName];
      bone.position
      bone.scale
      bone.rotation
    }
  }
  return;
}

AnimationProcessor.getInstance().registerAP(APWalk, [
  AnimationTypes.walk,
]);
