import {AnimationDefinition180, Molang} from "../types/AnimationSchema180";
import {AnimationTypes} from "../types/AnimationTypes";
import {APUtils} from "./APUtils";


/**
 * hug 动画处理：根骨骼 position.z 取反（Java / 基岩坐标系差异）
 */
export const data = {
  types: [
    AnimationTypes.hug,
  ],
  func: async (animation: AnimationDefinition180) => {
    if (!animation.bones) {
      return;
    }
    for (const boneName of Object.keys(animation.bones)) {
      let lowerName = boneName.toLowerCase();
      // if (!['root', 'AllBody'].includes(lowerName)) {
      //   continue;
      // }
      APUtils.forEachVec3MolangOfChannel(animation.bones[boneName].position, (vec3) => {
        vec3[2] = negateMolang(vec3[2]);
      });
    }
  },
};

/** 对 Molang 表达式乘 -1 */
function negateMolang(value: Molang): Molang {
  if (typeof value === 'number') {
    return -value;
  }
  return `-(${value})`;
}
