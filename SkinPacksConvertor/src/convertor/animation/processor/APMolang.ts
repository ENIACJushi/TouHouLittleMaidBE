import {AnimationDefinition180, Molang} from "../types/AnimationSchema180";
import {replacePrefixedExpressions} from "../../molang/PrefixedExpression";
import {resolveYsmExpression} from "../../molang/ysm/YsmResolvers";
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



let processMolang = (_molang: Molang) => {
  if (typeof _molang === 'string') {
    let molang = _molang;
    // 删除 ';'
    if (molang.includes(';')) {
      molang = molang.replace(/;/g, '');
    }
    // 对于 "=" 只保留右值
    if (molang.includes('=')) {
      for (let i = 0; i < molang.length; i++) {
        if (molang[i] !== '=') continue;

        const prev = i > 0 ? molang[i - 1] : '';
        const next = i < molang.length - 1 ? molang[i + 1] : '';
        const isSingleAssign = prev !== '=' && next !== '=' && prev !== '!' && prev !== '<' && prev !== '>';

        if (isSingleAssign) {
          const rightValue = molang.slice(i + 1).trim();
          molang = rightValue || molang;
        }
      }
    }
    // 前缀字段链适配；候选前缀由 DEFAULT_EXPRESSION_PREFIXES 统一维护
    molang = replacePrefixedExpressions(molang, handlePrefixedExpression);

    return molang;
  }
  return _molang;
}

/**
 * 按根前缀分发替换规则。
 * - ysm：走既有 ysm resolver
 * - v：后续在此接入属性兜底；暂时原样返回，避免误伤
 */
let handlePrefixedExpression = (expression: string, prefix: string): string => {
  if (prefix === 'ysm') {
    return resolveYsmExpression(expression);
  }
  // 属性兜底适配（v.xxx 等）预留
  return expression;
};
