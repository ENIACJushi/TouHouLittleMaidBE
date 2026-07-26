import {parseYsmExpression, YsmSegment} from "../PrefixedExpression";

/**
 * 单条 ysm 解析规则。
 *
 * 返回值说明：
 * - `string`：表示命中并给出替换结果
 * - `undefined`：表示该规则不处理当前表达式，交给下一条规则
 */
export type YsmExpressionResolver = (segments: YsmSegment[], rawExpression: string) => string | undefined;

/**
 * 规则：
 * `ysm.bone_rot('LeftM1').x|y|z`
 * => `query.bone_rotation('LeftM1').x|y|z`
 */
const resolveBoneRot: YsmExpressionResolver = (segments) => {
  if (segments.length !== 3) {
    return undefined;
  }

  const [root, call, axis] = segments;
  const isBoneRot =
    root.name === 'ysm'
    && call.name === 'bone_rot'
    && Array.isArray(call.params)
    && call.params.length >= 1
    && (axis.name === 'x' || axis.name === 'y' || axis.name === 'z');

  if (!isBoneRot) {
    return undefined;
  }

  const boneName = call.params![0];
  return `query.bone_rotation(${boneName}).${axis.name}`;
};

/**
 * ysm 规则列表。
 *
 * 后续新增规则时，按优先级从上到下追加即可。
 */
const ysmResolvers: YsmExpressionResolver[] = [
  // resolveBoneRot
];

/**
 * ysm 表达式统一解析入口。
 *
 * - 先拆分结构
 * - 再按顺序尝试规则
 * - 全部未命中时，返回默认值 `'1'`
 */
export const resolveYsmExpression = (ysmExpression: string): string => {
  const parsedSegments = parseYsmExpression(ysmExpression);

  for (const resolver of ysmResolvers) {
    const resolved = resolver(parsedSegments, ysmExpression);
    if (resolved !== undefined) {
      return resolved;
    }
  }

  return '1';
};
