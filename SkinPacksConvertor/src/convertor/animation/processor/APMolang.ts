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

const isIdentifierChar = (char: string): boolean => /[A-Za-z0-9_]/.test(char);

const consumeIdentifier = (source: string, startIndex: number): number => {
  let index = startIndex;
  while (index < source.length && isIdentifierChar(source[index])) {
    index++;
  }
  return index;
};

const consumeBalancedParentheses = (source: string, startIndex: number): number => {
  if (source[startIndex] !== '(') {
    return startIndex;
  }

  let index = startIndex;
  let depth = 0;
  let quote: '' | '"' | "'" = '';

  while (index < source.length) {
    const char = source[index];

    if (quote) {
      if (char === '\\') {
        index += 2;
        continue;
      }
      if (char === quote) {
        quote = '';
      }
      index++;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      index++;
      continue;
    }

    if (char === '(') {
      depth++;
      index++;
      continue;
    }

    if (char === ')') {
      depth--;
      index++;
      if (depth === 0) {
        return index;
      }
      continue;
    }

    index++;
  }

  // 括号不平衡时，退回 startIndex，让上层逻辑仅匹配到 `ysm.xxx`
  return startIndex;
};

function replaceYsmExpressions(source: string, replacer: (ysmExpression: string) => string): string {
  let result = '';
  let index = 0;

  while (index < source.length) {
    const ysmIndex = source.indexOf('ysm.', index);
    if (ysmIndex < 0) {
      result += source.slice(index);
      break;
    }

    result += source.slice(index, ysmIndex);

    const identifierStart = ysmIndex + 4;
    let endIndex = consumeIdentifier(source, identifierStart);

    if (endIndex === identifierStart) {
      // 不是有效的 `ysm.xxx`，按普通文本处理
      result += 'ysm.';
      index = identifierStart;
      continue;
    }

    if (source[endIndex] === '(') {
      const callEndIndex = consumeBalancedParentheses(source, endIndex);
      if (callEndIndex > endIndex) {
        endIndex = callEndIndex;
      }
    }

    while (source[endIndex] === '.') {
      const propertyStart = endIndex + 1;
      const propertyEnd = consumeIdentifier(source, propertyStart);
      if (propertyEnd === propertyStart) {
        break;
      }
      endIndex = propertyEnd;
    }

    const matched = source.slice(ysmIndex, endIndex);
    result += replacer(matched);
    index = endIndex;
  }

  return result;
}

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
    // ysm 动画属性适配
    if (molang.includes('ysm.')) {
      molang = replaceYsmExpressions(molang, handleYsmExpression);
    }

    return molang;
  }
  return _molang;
}

let handleYsmExpression = (_ysmExpression: string): string => {
  // TODO: 根据 ysmExpression 的具体内容返回不同替换值
  return '1';
};
