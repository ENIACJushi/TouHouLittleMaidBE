import {Molang} from "../types/AnimationSchema180";
import {AnimationTypes} from "../types/AnimationTypes";
import {APUtils} from "./APUtils";
import {APContext} from "./APTypes";


/**
 * hug 动画处理：根骨骼 position.z 取反（Java / 基岩坐标系差异），并按模型缩放校正位移
 */
export const data = {
  types: [
    AnimationTypes.hug,
  ],
  func: async ({ animation, scale }: APContext) => {
    if (!animation.bones) {
      return;
    }
    for (const boneName of Object.keys(animation.bones)) {
      let lowerName = boneName.toLowerCase();
      if (!['root', 'allbody'].includes(lowerName)) {
        continue;
      }
      APUtils.forEachVec3MolangOfChannel(animation.bones[boneName].position, (vec3) => {
        // z轴反转并缩放
        vec3[2] = negateMolang(vec3[2], scale);
        // y、x轴仅缩放
        vec3[1] = scaleMolang(vec3[1], scale);
        vec3[0] = scaleMolang(vec3[0], scale);
      });
    }
  },
};

/** 对 Molang 表达式乘 -1，并乘以模型缩放 */
function negateMolang(value: Molang, scale: number = 1): Molang {
  if (typeof value === 'number') {
    return -value * scale;
  }
  return `-${scale}*(${value})`;
}

/** 对 Molang 表达式，乘以模型缩放 */
function scaleMolang(value: Molang, scale: number = 1) {
  if (typeof value === 'number') {
    return value * scale;
  }
  return `${scale}*(${value})`;
}
