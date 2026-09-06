import {MolangLexer, Token, TokenKind} from '../engin';

/**
 * Java / YSM 手持槽位 → 基岩 equipment slot
 *
 * 源动画常见写法：`Mainhand` / `Offhand`（Gecko/YSM）
 * 基岩要求：`slot.weapon.mainhand` / `slot.weapon.offhand`
 */
const JAVA_HAND_SLOT_TO_BEDROCK: Readonly<Record<string, string>> = {
  mainhand: 'slot.weapon.mainhand',
  main_hand: 'slot.weapon.mainhand',
  'slot.weapon.mainhand': 'slot.weapon.mainhand',
  offhand: 'slot.weapon.offhand',
  off_hand: 'slot.weapon.offhand',
  'slot.weapon.offhand': 'slot.weapon.offhand',
};

/** 缺省命名空间：无 `:` 的物品 id 补为 `minecraft:` */
const DEFAULT_ITEM_NAMESPACE = 'minecraft';

/**
 * 将 molang 中的 Java 风格 `is_item_name_any` 转为基岩格式。
 *
 * - `q.is_item_name_any('Mainhand', 'bow')`
 *   → `q.is_item_name_any('slot.weapon.mainhand', 0, 'minecraft:bow')`
 * - 已是 `slot.*` + 可选 index 的调用：补全物品命名空间，缺 index 时插入 `0`
 * - 无法识别的槽位原样保留
 */
export const convertJavaItemNameAnyQueries = (source: string): string => {
  if (!/is_item_name_any/i.test(source)) {
    return source;
  }

  const tokens = MolangLexer.tokenizeAll(source);
  let result = '';
  let cursor = 0;

  for (let i = 0; i < tokens.length; i++) {
    const call = matchIsItemNameAnyCall(tokens, i);
    if (!call) {
      continue;
    }

    const converted = convertIsItemNameAnyCall(source, call);
    if (converted === null) {
      continue;
    }

    result += source.slice(cursor, call.start);
    result += converted;
    cursor = call.end;
    // 跳到闭合括号 token，循环 +1 后从下一 token 继续
    i = call.closeIndex;
  }

  if (cursor === 0) {
    return source;
  }
  return result + source.slice(cursor);
};

type ItemNameAnyCall = {
  /** 整段调用在源码中的起始（含 q./query.） */
  start: number;
  /** 整段调用在源码中的结束（含 `)`） */
  end: number;
  /** 函数名结束位置（用于截取 `q.is_item_name_any` 原文） */
  calleeEnd: number;
  /** 闭合 `)` 的 token 下标 */
  closeIndex: number;
  /** 顶层参数 token 片段（每个参数为一段 token） */
  argSpans: Token[][];
};

/**
 * 匹配 `q.is_item_name_any(...)` / `query.is_item_name_any(...)`
 */
const matchIsItemNameAnyCall = (
  tokens: Token[],
  index: number,
): ItemNameAnyCall | null => {
  const root = tokens[index];
  const dot = tokens[index + 1];
  const name = tokens[index + 2];
  const open = tokens[index + 3];
  if (
    root?.kind !== TokenKind.IDENTIFIER
    || (root.value !== 'q' && root.value !== 'query')
    || dot?.kind !== TokenKind.DOT
    || name?.kind !== TokenKind.IDENTIFIER
    || name.value !== 'is_item_name_any'
    || open?.kind !== TokenKind.LPAREN
  ) {
    return null;
  }

  const closeIndex = findBalancedClose(tokens, index + 3);
  if (closeIndex === null) {
    return null;
  }

  return {
    start: root.start,
    end: tokens[closeIndex].end,
    calleeEnd: name.end,
    closeIndex,
    argSpans: splitTopLevelArgs(tokens, index + 4, closeIndex),
  };
};

const findBalancedClose = (tokens: Token[], openIndex: number): number | null => {
  let depth = 0;
  for (let i = openIndex; i < tokens.length; i++) {
    const kind = tokens[i].kind;
    if (kind === TokenKind.LPAREN) {
      depth++;
    } else if (kind === TokenKind.RPAREN) {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }
  return null;
};

/** 按顶层逗号拆分参数 token 段 */
const splitTopLevelArgs = (
  tokens: Token[],
  startIndex: number,
  closeIndex: number,
): Token[][] => {
  const args: Token[][] = [];
  let current: Token[] = [];
  let depth = 0;

  for (let i = startIndex; i < closeIndex; i++) {
    const token = tokens[i];
    if (token.kind === TokenKind.LPAREN || token.kind === TokenKind.LBRACKET || token.kind === TokenKind.LBRACE) {
      depth++;
      current.push(token);
      continue;
    }
    if (token.kind === TokenKind.RPAREN || token.kind === TokenKind.RBRACKET || token.kind === TokenKind.RBRACE) {
      depth--;
      current.push(token);
      continue;
    }
    if (token.kind === TokenKind.COMMA && depth === 0) {
      if (current.length > 0) {
        args.push(current);
      }
      current = [];
      continue;
    }
    current.push(token);
  }
  if (current.length > 0) {
    args.push(current);
  }
  return args;
};

/**
 * 转换单次调用；无法安全转换时返回 null（保留原文）。
 */
const convertIsItemNameAnyCall = (
  source: string,
  call: ItemNameAnyCall,
): string | null => {
  if (call.argSpans.length < 2) {
    return null;
  }

  const slotArg = call.argSpans[0];
  if (slotArg.length !== 1 || slotArg[0].kind !== TokenKind.STRING) {
    return null;
  }

  const slotRaw = (slotArg[0].value ?? '').trim();
  const bedrockSlot = resolveBedrockSlot(slotRaw);
  if (!bedrockSlot) {
    return null;
  }

  const rest = call.argSpans.slice(1);
  let indexLiteral = '0';
  let itemSpans = rest;

  // 已是基岩写法且第二参为槽位下标时保留该下标
  if (rest.length >= 1 && isNumericArg(rest[0])) {
    indexLiteral = renderArg(source, rest[0]);
    itemSpans = rest.slice(1);
  }

  if (itemSpans.length === 0) {
    return null;
  }

  const itemLiterals: string[] = [];
  for (const span of itemSpans) {
    if (span.length !== 1 || span[0].kind !== TokenKind.STRING) {
      // 物品参数不是纯字符串时不做强改，避免误伤复杂表达式
      return null;
    }
    itemLiterals.push(quoteMolangString(toFullItemId(span[0].value ?? '')));
  }

  const callee = source.slice(call.start, call.calleeEnd);
  return `${callee}('${bedrockSlot}', ${indexLiteral}, ${itemLiterals.join(', ')})`;
};

const resolveBedrockSlot = (slotRaw: string): string | null => {
  const key = slotRaw.trim().toLowerCase();
  return JAVA_HAND_SLOT_TO_BEDROCK[key] ?? null;
};

const isNumericArg = (span: Token[]): boolean => {
  if (span.length === 1 && span[0].kind === TokenKind.FLOAT) {
    return true;
  }
  // 允许 `-0` 这类带符号数字
  if (
    span.length === 2
    && (span[0].kind === TokenKind.SUB || span[0].kind === TokenKind.PLUS)
    && span[1].kind === TokenKind.FLOAT
  ) {
    return true;
  }
  return false;
};

const renderArg = (source: string, span: Token[]): string => {
  const start = span[0].start;
  const end = span[span.length - 1].end;
  return source.slice(start, end);
};

/** 无命名空间则补 `minecraft:`；已有 `:` 则原样 */
const toFullItemId = (itemId: string): string => {
  const id = itemId.trim();
  if (!id) {
    return id;
  }
  if (id.includes(':')) {
    return id;
  }
  return `${DEFAULT_ITEM_NAMESPACE}:${id}`;
};

const quoteMolangString = (value: string): string => `'${value}'`;
