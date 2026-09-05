import {AnimationDefinition180, BoneAnimation, Molang} from "../types/AnimationSchema180";
import {
  PrefixedExpressionOperatorContext,
  PrefixedExpressionReplaceResult,
  replacePrefixedExpressions,
} from "../../molang/PrefixedExpression";
import {MolangLexer, Token, TokenKind} from "../../molang/engin";
import {resolveYsmExpression} from "../../molang/ysm/YsmResolvers";
import {
  AnimationBoneChannel,
  registerMolangVariableKeep,
  resolveVariableExpression,
} from "../../molang/v/VariableResolvers";
import {
  fieldFromVariableLhs,
  findSingleAssignIndex,
  isVariableAssignTarget,
} from "../../molang/MolangAssign";
import {resolveTlmExpression} from "../../molang/tlm/TlmResolvers";
import {convertJavaItemNameAnyQueries} from "../../molang/query/ItemQueryResolvers";
import {convertJavaWaterBooleanQueries} from "../../molang/query/WaterQueryResolvers";
import {convertJavaHeadRotationQueries} from "../../molang/query/HeadRotationQueryResolvers";
import {insertExplicitMultiply} from "../../molang/ImplicitMultiplyFix";
import {APUtils} from "./APUtils";


/** 是否为 molang 伪骨骼：`molang` / `molang2` / `molang3` …（大小写不敏感） */
const isMolangPseudoBone = (boneName: string): boolean => {
  return /^molang\d*$/i.test(boneName);
};

/**
 * molang 处理
 *  java 版的molang格式无法被基岩版体系识别，需要额外处理，并删除不支持的部分
 */
export const data = {
  types: undefined, // 对所有动画均执行
  func: async ({ animation }) => {
    ///// 处理骨骼：molang 伪骨骼 /////
    if (animation.bones) {
      const molangBoneNames = Object.keys(animation.bones).filter(isMolangPseudoBone);

      // 先登记所有伪骨骼赋值左值到 keep，避免 molang2 引用尚未处理的 molang3 变量时被兜底成 0/1
      for (const boneName of molangBoneNames) {
        registerMolangBoneAssignTargets(animation.bones[boneName]);
      }

      // 收集赋值脚本并删除伪骨骼（keep 已在上一轮登记，此处不再重复）
      for (const boneName of molangBoneNames) {
        const bone = animation.bones[boneName];
        const scripts = collectMolangBoneScripts(bone);
        if (scripts.length > 0) {
          if (!animation.extractedScripts) {
            animation.extractedScripts = [];
          }
          // 抽到实体 pre_animation 后不再有动画上下文，anim_time 恒为 0 → 改用 life_time
          animation.extractedScripts.push(...scripts.map(rewriteAnimTimeForEntityScripts));
        }
        delete animation.bones[boneName];
      }
    }

    ///// timeline 赋值左值 → keep（须在骨骼通道 / timeline 右值转换之前）/////
    // 酒狐弹簧物理：常数与积分写在 parallel 的 timeline，Tail 在 pre_parallel 引用；
    // keep 为进程内全局集合，跨动画也能生效（parallel 先于 pre_parallel 处理）。
    if (animation.timeline) {
      registerTimelineAssignTargets(animation.timeline);
    }

    ///// 普通骨骼通道转换 /////
    if (animation.bones) {
      for (const boneName of Object.keys(animation.bones)) {
        const bone = animation.bones[boneName];
        bone.position = APUtils.forEachMolangOfChannel(bone.position, (m) => processMolang(m, 'position'));
        bone.rotation = APUtils.forEachMolangOfChannel(bone.rotation, (m) => processMolang(m, 'rotation'));
        bone.scale = APUtils.forEachMolangOfChannel(bone.scale, (m) => processMolang(m, 'scale'));
      }
    }

    ///// 转换 timeline，并将纯赋值抽到实体 scripts 每帧执行 /////
    // 基岩 RP 的 animation.timeline 对弹簧积分这类高频赋值不可靠；
    // 按时间键排序后整段并入 extractedScripts，由实体 scripts.pre_animation 门控驱动。
    if (animation.timeline) {
      for (const timeNode of Object.keys(animation.timeline)) {
        const node = animation.timeline[timeNode];
        if (Array.isArray(node)) {
          animation.timeline[timeNode] = node.map((script) => convertTimelineAssignment(script));
        } else if (typeof node === 'string') {
          animation.timeline[timeNode] = convertTimelineAssignment(node);
        }
      }
      const timelineScripts = flattenTimelineAssignmentScripts(animation.timeline);
      if (timelineScripts.length > 0) {
        if (!animation.extractedScripts) {
          animation.extractedScripts = [];
        }
        animation.extractedScripts.push(
          ...timelineScripts.map(rewriteAnimTimeForEntityScripts),
        );
        delete animation.timeline;
        // 仅剩空壳循环时去掉 length，避免无意义的短周期动画
        if (!animation.bones || Object.keys(animation.bones).length === 0) {
          delete animation.animation_length;
        }
      } else {
        ensureTimelineFitsAnimationLength(animation);
      }
    }

    // Java/Gecko 的 blend_weight 在基岩 scripts.animate 下不可靠，且依赖 anim_time；直接去掉
    delete animation.blend_weight;

    return;
  }
};

/**
 * 转换 timeline 中的赋值语句。
 * 与 Molang 伪骨骼一致：左值保留，右值走 processMolang；多条赋值写回为连续语句。
 */
const convertTimelineAssignment = (source: string): string => {
  const scripts = convertAssignmentsToScripts(source, 'script');
  return scripts.length > 0 ? scripts.join('') : source;
};

/**
 * 伪骨骼 / timeline 脚本写入实体 scripts 后无动画上下文，
 * `query.anim_time` 恒为 0，需改为 `query.life_time`。
 */
const rewriteAnimTimeForEntityScripts = (script: string): string => {
  return script.replace(/\b(?:query|q)\.anim_time\b/gi, 'query.life_time');
};

/**
 * 按时间键升序展开 timeline 中的赋值语句（已转换后的 string / string[]）。
 */
const flattenTimelineAssignmentScripts = (
  timeline: Record<string, string | string[]>,
): string[] => {
  const keys = Object.keys(timeline).sort((a, b) => Number(a) - Number(b));
  const scripts: string[] = [];
  for (const key of keys) {
    const node = timeline[key];
    if (Array.isArray(node)) {
      for (const item of node) {
        if (typeof item === 'string' && item.includes('=')) {
          scripts.push(item.endsWith(';') ? item : `${item};`);
        }
      }
    } else if (typeof node === 'string' && node.includes('=')) {
      scripts.push(node.endsWith(';') ? node : `${node};`);
    }
  }
  return scripts;
};

/**
 * 保证 animation_length 严格大于最大 timeline 键，避免循环时边界帧不触发。
 */
const ensureTimelineFitsAnimationLength = (animation: AnimationDefinition180): void => {
  if (!animation.timeline) {
    return;
  }
  let maxKey = -Infinity;
  for (const key of Object.keys(animation.timeline)) {
    const t = Number(key);
    if (!Number.isNaN(t)) {
      maxKey = Math.max(maxKey, t);
    }
  }
  if (!Number.isFinite(maxKey) || maxKey < 0) {
    return;
  }
  const len = Number(animation.animation_length);
  if (!Number.isFinite(len) || len <= maxKey) {
    animation.animation_length = Number((maxKey + 0.0001).toFixed(4));
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
      const assignIdx = findSingleAssignIndex(molang);
      if (assignIdx >= 0) {
        const rightValue = molang.slice(assignIdx + 1).trim();
        molang = rightValue || molang;
      }
    }
    // 隐式乘法 → 显式 `*`（须尽早，避免后续解析/替换踩到非法 `1(`）
    molang = insertExplicitMultiply(molang);
    // 前缀字段链适配；候选前缀由 DEFAULT_EXPRESSION_PREFIXES 统一维护
    molang = replacePrefixedExpressions(molang, (expression, prefix, ctx) =>
      handlePrefixedExpression(expression, prefix, ctx, channel),
    );
    // Java/YSM 手持物品 query → 基岩 slot + 完整物品 id
    molang = convertJavaItemNameAnyQueries(molang);
    // 水/雨 query：Java 当布尔，基岩改为 ==1 / ==0
    molang = convertJavaWaterBooleanQueries(molang);
    // 头部旋转 query：Java 无参，基岩补固定参数 0
    molang = convertJavaHeadRotationQueries(molang);
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
): PrefixedExpressionReplaceResult => {
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
 *
 * 未匹配变量在 `??` 左侧的情况已在 {@link replacePrefixedExpressions} 中直接取右值，
 * 不会进入本函数的数值左值分支。
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

///// 赋值左值 → keep 白名单 /////
/**
 * 从源字符串扫描 `v.` / `variable.` 赋值左值并登记 keep（不转换右值）。
 */
const registerAssignTargetsFromSource = (source: string): void => {
  const statements = source.split(';').map((s) => s.trim()).filter((s) => s.length > 0);
  for (const statement of statements) {
    const assignIdx = findSingleAssignIndex(statement);
    if (assignIdx < 0) {
      continue;
    }
    const lhs = statement.slice(0, assignIdx).trim();
    if (!isVariableAssignTarget(lhs)) {
      continue;
    }
    registerMolangVariableKeep(fieldFromVariableLhs(lhs));
  }
};

/** 登记 timeline 全部节点中的赋值左值 */
const registerTimelineAssignTargets = (
  timeline: Record<string, string | string[]>,
): void => {
  for (const node of Object.values(timeline)) {
    if (Array.isArray(node)) {
      for (const script of node) {
        registerAssignTargetsFromSource(script);
      }
    } else if (typeof node === 'string') {
      registerAssignTargetsFromSource(node);
    }
  }
};

/**
 * 从伪骨骼通道中扫描赋值左值并登记 keep。
 * 用于在抽取脚本前建立白名单，保证跨伪骨骼引用（如 molang2 → molang3）不被兜底。
 */
const registerMolangBoneAssignTargets = (bone: BoneAnimation): void => {
  const visit = (_channel: AnimationBoneChannel) => (m: Molang): Molang => {
    if (typeof m === 'string') {
      registerAssignTargetsFromSource(m);
    }
    return m;
  };
  APUtils.forEachMolangOfChannel(bone.position, visit('position'));
  APUtils.forEachMolangOfChannel(bone.rotation, visit('rotation'));
  APUtils.forEachMolangOfChannel(bone.scale, visit('scale'));
};

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
