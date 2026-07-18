import {AnimationDefinition180, Molang} from "../types/AnimationSchema180";
import {APUtils} from "./APUtils";


/**
 * molang 处理
 *  java 版的molang格式无法被基岩版体系识别，需要额外处理，并删除不支持的部分
 */
export const data = {
  types: undefined, // 对所有动画均执行
  func: async (animation: AnimationDefinition180) => {
    if (animation.bones) {
      for (let boneName in animation.bones) {
        let bone = animation.bones[boneName];
        bone.position = APUtils.forEachMolangOfChannel(bone.position, processMolang);
        bone.rotation = APUtils.forEachMolangOfChannel(bone.rotation, processMolang);
        bone.scale = APUtils.forEachMolangOfChannel(bone.scale, processMolang);
      }
    }
    return;
  }
};

let processMolang = (molang: Molang) => {
  if (typeof molang === 'string') {
    if (molang.includes('=')) {
      // 对于 "=" 只保留右值
      for (let i = 0; i < molang.length; i++) {
        if (molang[i] !== '=') continue;

        const prev = i > 0 ? molang[i - 1] : '';
        const next = i < molang.length - 1 ? molang[i + 1] : '';
        const isSingleAssign = prev !== '=' && next !== '=' && prev !== '!' && prev !== '<' && prev !== '>';

        if (isSingleAssign) {
          const rightValue = molang.slice(i + 1).trim();
          return rightValue || molang;
        }
      }
    }
  }
  return molang;
}