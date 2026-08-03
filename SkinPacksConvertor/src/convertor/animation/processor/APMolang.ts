import {AnimationDefinition180, BoneAnimation, Molang} from "../types/AnimationSchema180";
import {
  PrefixedExpressionOperatorContext,
  replacePrefixedExpressions,
} from "../../molang/PrefixedExpression";
import {MolangLexer, Token, TokenKind} from "../../molang/engin";
import {resolveYsmExpression} from "../../molang/ysm/YsmResolvers";
import {
  AnimationBoneChannel,
  registerMolangVariableKeep,
  resolveVariableExpression,
} from "../../molang/v/VariableResolvers";
import {resolveTlmExpression} from "../../molang/tlm/TlmResolvers";
import {APUtils} from "./APUtils";


/**
 * molang 处理
 *  java 版的molang格式无法被基岩版体系识别，需要额外处理，并删除不支持的部分
 */
export const data = {
  types: undefined, // 对所有动画均执行
  func: async (animation: AnimationDefinition180) => {
    ///// 处理骨骼 /////
    if (animation.bones) {
      // 第一遍：收集 molang 伪骨骼赋值，并提前加入 keep 白名单，供后续骨骼转换保留引用
      for (const boneName of Object.keys(animation.bones)) {
        if (boneName !== 'molang' && boneName !== 'Molang' && boneName !== 'molang2' && boneName !== 'Molang2') {
          continue;
        }
        const bone = animation.bones[boneName];
        const scripts = collectMolangBoneScripts(bone);
        if (scripts.length > 0) {
          // 将赋值规则加入与 bones 平级的预留属性
          if (!animation.extractedScripts) {
            animation.extractedScripts = [];
          }
          animation.extractedScripts.push(...scripts);
          for (const script of scripts) {
            // 查找等号
            const assignIdx = findSingleAssignIndex(script);
            if (assignIdx < 0) {
              continue;
            }
            const lhs = script.slice(0, assignIdx).trim();
            const lower = lhs.toLowerCase();
            if (!lower.startsWith('v.') && !lower.startsWith('variable.')) {
              continue;
            }
            registerMolangVariableKeep(lhs.replace(/^(?:v|variable)\./i, ''));
          }
        }
        delete animation.bones[boneName];
      }

      // 第二遍：普通骨骼转换
      for (const boneName of Object.keys(animation.bones)) {
        const bone = animation.bones[boneName];
        bone.position = APUtils.forEachMolangOfChannel(bone.position, (m) => processMolang(m, 'position'));
        bone.rotation = APUtils.forEachMolangOfChannel(bone.rotation, (m) => processMolang(m, 'rotation'));
        bone.scale = APUtils.forEachMolangOfChannel(bone.scale, (m) => processMolang(m, 'scale'));
      }
    }
    ///// 处理 timeline /////
    // timeline 节点为赋值语句（string 或 string[]），左值保留、右值走 processMolang
    if (animation.timeline) {
      for (const timeNode of Object.keys(animation.timeline)) {
        const node = animation.timeline[timeNode];
        if (Array.isArray(node)) {
          animation.timeline[timeNode] = node.map((script) => convertTimelineAssignment(script));
        } else if (typeof node === 'string') {
          animation.timeline[timeNode] = convertTimelineAssignment(node);
        }
      }
    }
    return;
  }
};

/**
 * 转换 timeline 中的赋值语句。
 * 与 Molang 伪骨骼一致：左值保留，右值走 processMolang；多条赋值写回为连续语句。
 */
const convertTimelineAssignment = (source: string): string => {
  const scripts = convertAssignmentsToScripts(source, 'position');
  return scripts.length > 0 ? scripts.join('') : source;
};

/**
 * 定位第一个单字符赋值 `=` 的下标（排除 ==、!=、<=、>=）。
 */
const findSingleAssignIndex = (source: string): number => {
  for (let i = 0; i < source.length; i++) {
    if (source[i] !== '=') continue;
    const prev = i > 0 ? source[i - 1] : '';
    const next = i < source.length - 1 ? source[i + 1] : '';
    if (prev !== '=' && next !== '=' && prev !== '!' && prev !== '<' && prev !== '>') {
      return i;
    }
  }
  return -1;
};

/** 是否为 `v.xxx` / `variable.xxx` 赋值目标 */
const isVariableAssignTarget = (lhs: string): boolean => {
  const lower = lhs.toLowerCase();
  return lower.startsWith('v.') || lower.startsWith('variable.');
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
      const assignIdx = findSingleAssignIndex(molang);
      if (assignIdx >= 0) {
        const rightValue = molang.slice(assignIdx + 1).trim();
        molang = rightValue || molang;
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
 * - ysm / v / variable / tlm：均按配置规则替换，未命中时按通道与运算符兜底
 */
let handlePrefixedExpression = (
  expression: string,
  prefix: string,
  ctx: PrefixedExpressionOperatorContext,
  channel: AnimationBoneChannel,
): string => {
  if (prefix === 'ysm') {
    return resolveYsmExpression(expression, channel, ctx);
  }
  if (prefix === 'v' || prefix === 'variable') {
    return resolveVariableExpression(expression, channel, ctx);
  }
  if (prefix === 'tlm') {
    return resolveTlmExpression(expression, channel, ctx);
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

///// Molang 伪骨骼解析 ///
/**
 * 将原始语句转为 scripts 条目。
 *  一行可含多条以 `;` 分隔的赋值；左值保留，右值走普通 molang 转换。
 */
const convertAssignmentsToScripts = (source: string, channel: AnimationBoneChannel): string[] => {
  const statements = source.split(';').map((s) => s.trim()).filter((s) => s.length > 0);
  const scripts: string[] = [];
  for (const statement of statements) {
    const assignIdx = findSingleAssignIndex(statement);
    if (assignIdx < 0) {
      continue;
    }
    const lhs = statement.slice(0, assignIdx).trim();
    const rhs = statement.slice(assignIdx + 1).trim();
    if (!lhs || !rhs || !isVariableAssignTarget(lhs)) {
      continue;
    }
    const convertedRhs = processMolang(rhs, channel);
    scripts.push(`${lhs}=${convertedRhs};`);
  }
  return scripts;
};

/**
 * 从 molang 伪骨骼各通道收集变量定义与赋值脚本。
 */
const collectMolangBoneScripts = (bone: BoneAnimation): string[] => {
  const scripts: string[] = [];
  const visit = (channel: AnimationBoneChannel) => (m: Molang): Molang => {
    if (typeof m === 'string') {
      scripts.push(...convertAssignmentsToScripts(m, channel));
    }
    return m;
  };
  APUtils.forEachMolangOfChannel(bone.position, visit('position'));
  APUtils.forEachMolangOfChannel(bone.rotation, visit('rotation'));
  APUtils.forEachMolangOfChannel(bone.scale, visit('scale'));
  return scripts;
};
