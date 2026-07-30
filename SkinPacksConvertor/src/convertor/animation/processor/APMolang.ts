import {AnimationDefinition180, Molang} from "../types/AnimationSchema180";
import {
  PrefixedExpressionOperatorContext,
  replacePrefixedExpressions,
} from "../../molang/PrefixedExpression";
import {MolangLexer, Token, TokenKind} from "../../molang/engin";
import {resolveYsmExpression} from "../../molang/ysm/YsmResolvers";
import {
  AnimationBoneChannel,
  resolveVariableExpression,
} from "../../molang/v/VariableResolvers";
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
        bone.position = APUtils.forEachMolangOfChannel(bone.position, (m) => processMolang(m, 'position'));
        bone.rotation = APUtils.forEachMolangOfChannel(bone.rotation, (m) => processMolang(m, 'rotation'));
        bone.scale = APUtils.forEachMolangOfChannel(bone.scale, (m) => processMolang(m, 'scale'));
      }
    }
    return;
  }
};



let processMolang = (_molang: Molang, channel: AnimationBoneChannel) => {
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
    molang = replacePrefixedExpressions(molang, (expression, prefix, ctx) =>
      handlePrefixedExpression(expression, prefix, ctx, channel),
    );
    // 全部处理结束后：基岩版 `??` 左侧不能是数值，化简为左值
    molang = simplifyNumericNullCoalesce(molang);

    return molang;
  }
  return _molang;
}

/**
 * 按根前缀分发替换规则。
 * - ysm：走既有 ysm resolver
 * - v / variable：白名单保留，其余按通道与运算符兜底
 */
let handlePrefixedExpression = (
  expression: string,
  prefix: string,
  ctx: PrefixedExpressionOperatorContext,
  channel: AnimationBoneChannel,
): string => {
  if (prefix === 'ysm') {
    return resolveYsmExpression(expression);
  }
  if (prefix === 'v' || prefix === 'variable') {
    return resolveVariableExpression(expression, channel, ctx);
  }
  return expression;
};

///// `??` 运算符化简为左值 /////
/**
 * 全部处理结束后的检查层：
 * 基岩版限制 `??` 左侧必须是直接变量引用，不能是数值。
 * 对所有「左边是数值」的 `??` 表达式，直接化简为左边的值。
 * 例：`0??1` → `0`；`1??0` → `1`
 */
const simplifyNumericNullCoalesce = (source: string): string => {
  if (!source.includes('??')) {
    return source;
  }
  let current = source;
  // 链式 `0??1??2` 需多次化简
  for (;;) {
    const next = simplifyNumericNullCoalesceOnce(current);
    if (next === current) {
      return current;
    }
    current = next;
  }
};

const simplifyNumericNullCoalesceOnce = (source: string): string => {
  const tokens = MolangLexer.tokenizeAll(source);
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].kind !== TokenKind.QUESQUES) {
      continue;
    }
    const left = tokens[i - 1];
    // 仅处理左侧为数值（FLOAT）的情况
    if (!left || left.kind !== TokenKind.FLOAT) {
      continue;
    }
    const rhsEnd = findNullCoalesceRhsEnd(tokens, i + 1);
    if (rhsEnd === null) {
      continue;
    }
    // 删掉 `??` 及其右值，保留左侧数值
    return source.slice(0, tokens[i].start) + source.slice(tokens[rhsEnd].end);
  }
  return source;
};

/**
 * 定位 `??` 右值的最后一个 token 下标。
 * 在括号深度为 0 时，遇到逗号、分号、赋值、下一个 `??` 或越界闭括号则结束。
 */
const findNullCoalesceRhsEnd = (tokens: Token[], startIndex: number): number | null => {
  if (startIndex >= tokens.length) {
    return null;
  }
  let paren = 0;
  let bracket = 0;
  let brace = 0;
  let last = startIndex;

  for (let i = startIndex; i < tokens.length; i++) {
    const kind = tokens[i].kind;
    if (paren === 0 && bracket === 0 && brace === 0) {
      if (
        kind === TokenKind.COMMA
        || kind === TokenKind.SEMICOLON
        || kind === TokenKind.EQ
        || kind === TokenKind.QUESQUES
        || kind === TokenKind.RPAREN
        || kind === TokenKind.RBRACKET
        || kind === TokenKind.RBRACE
      ) {
        break;
      }
    }
    if (kind === TokenKind.LPAREN) {
      paren++;
    } else if (kind === TokenKind.RPAREN) {
      if (paren === 0) {
        break;
      }
      paren--;
    } else if (kind === TokenKind.LBRACKET) {
      bracket++;
    } else if (kind === TokenKind.RBRACKET) {
      if (bracket === 0) {
        break;
      }
      bracket--;
    } else if (kind === TokenKind.LBRACE) {
      brace++;
    } else if (kind === TokenKind.RBRACE) {
      if (brace === 0) {
        break;
      }
      brace--;
    }
    last = i;
  }
  return last;
};
