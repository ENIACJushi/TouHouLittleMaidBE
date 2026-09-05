import {MolangLexer, Token, TokenKind} from '../engin';

/**
 * Java 版无参、基岩版必须带参的头部旋转 query。
 * 基岩要求：非马/凋灵等特殊实体时参数固定为 `0`。
 *
 * 注意：YSM/TLM GeckoLib 中 `head_x_rotation=yaw`、`head_y_rotation=pitch`，
 * 与基岩语义对调；但此处**只补 (0)、不对调轴名**，以保持既有内置包转换结果稳定。
 * Head 骨上的注视叠乘由 {@link APHeadLookDedup} 处理；发丝/枪械等非 Head 通道沿用历史映射。
 */
const HEAD_ROTATION_QUERIES_NEED_ARG: ReadonlySet<string> = new Set([
  'head_x_rotation',
  'head_y_rotation',
]);

type HeadRotationMatch = {
  /** 替换区间起点（含 q./query.） */
  replaceStart: number;
  /** 替换区间终点（query 名结束） */
  replaceEnd: number;
  /** query 名 token 下标，供外层循环跳过 */
  nameIndex: number;
  replacement: string;
};

/**
 * 将无参的头部旋转 query 补为固定参数 `0`。
 *
 * - `query.head_x_rotation` → `query.head_x_rotation(0)`
 * - `query.head_y_rotation` → `query.head_y_rotation(0)`
 * - `q.head_*_rotation` 同样处理
 * - 已带括号（如 `query.head_x_rotation(0)`）时原样保留
 */
export const convertJavaHeadRotationQueries = (source: string): string => {
  if (!/head_[xy]_rotation/i.test(source)) {
    return source;
  }

  const tokens = MolangLexer.tokenizeAll(source);
  let result = '';
  let cursor = 0;

  for (let i = 0; i < tokens.length; i++) {
    const match = matchHeadRotationQueryWithoutArgs(source, tokens, i);
    if (!match) {
      continue;
    }

    result += source.slice(cursor, match.replaceStart);
    result += match.replacement;
    cursor = match.replaceEnd;
    i = match.nameIndex;
  }

  if (cursor === 0) {
    return source;
  }
  return result + source.slice(cursor);
};

/**
 * 匹配无参的 `q.head_x_rotation` / `query.head_y_rotation` 等
 */
const matchHeadRotationQueryWithoutArgs = (
  source: string,
  tokens: Token[],
  index: number,
): HeadRotationMatch | null => {
  const root = tokens[index];
  const dot = tokens[index + 1];
  const name = tokens[index + 2];
  if (
    root?.kind !== TokenKind.IDENTIFIER
    || (root.value !== 'q' && root.value !== 'query')
    || dot?.kind !== TokenKind.DOT
    || name?.kind !== TokenKind.IDENTIFIER
    || !name.value
    || !HEAD_ROTATION_QUERIES_NEED_ARG.has(name.value)
  ) {
    return null;
  }

  // 已带调用括号时不改写
  const next = tokens[index + 3];
  if (next?.kind === TokenKind.LPAREN) {
    return null;
  }

  const callee = source.slice(root.start, name.end);
  return {
    replaceStart: root.start,
    replaceEnd: name.end,
    nameIndex: index + 2,
    replacement: `${callee}(0)`,
  };
};
