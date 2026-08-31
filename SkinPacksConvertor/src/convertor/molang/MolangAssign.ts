/**
 * Molang 赋值语句解析工具（伪骨骼 / timeline / initialize / pre_animation 共用）。
 */

/** 定位第一个单字符赋值 `=` 的下标（排除 ==、!=、<=、>=）。 */
export const findSingleAssignIndex = (source: string): number => {
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

/** 是否为 `v.xxx` / `variable.xxx` 赋值左值 */
export const isVariableAssignTarget = (lhs: string): boolean => {
  const lower = lhs.toLowerCase();
  return lower.startsWith('v.') || lower.startsWith('variable.');
};

/**
 * 从赋值表达式解析变量左值：取第一个单字符 `=` 左侧，
 * 且以 `v.` / `variable.` 开头时返回该左值（如 `v.bv`）。
 */
export const parseVariableAssignLhs = (line: string): string | null => {
  const assignIdx = findSingleAssignIndex(line);
  if (assignIdx < 0) {
    return null;
  }
  const lhs = line.slice(0, assignIdx).trim();
  return isVariableAssignTarget(lhs) ? lhs : null;
};

/** 去重键：`variable.xxx` 与 `v.xxx` 视为同一变量 */
export const toVariableAssignKey = (varName: string): string => {
  return varName.toLowerCase().replace(/^variable\./, 'v.');
};

/** 从 `v.xxx` / `variable.xxx` 取出字段名（不含前缀） */
export const fieldFromVariableLhs = (varName: string): string => {
  return varName.replace(/^(?:v|variable)\./i, '');
};

/**
 * 将多条语句按 body 长度上限拆成若干段（保持顺序）。
 * 单条语句本身超限时仍单独成段（无法再拆）。
 */
export const chunkMolangStatements = (
  statements: readonly string[],
  maxBodyLen: number,
): string[] => {
  if (statements.length === 0) {
    return [];
  }
  const budget = Math.max(64, maxBodyLen);
  const bodies: string[] = [];
  let batch = '';
  for (const stmt of statements) {
    if (batch.length > 0 && batch.length + stmt.length > budget) {
      bodies.push(batch);
      batch = '';
    }
    if (batch.length === 0 && stmt.length > budget) {
      bodies.push(stmt);
      continue;
    }
    batch += stmt;
  }
  if (batch.length > 0) {
    bodies.push(batch);
  }
  return bodies;
};

/**
 * 将语句包进门控壳 `open + body + close`，并按整行长度上限拆成多条。
 */
export const chunkGatedMolangStatements = (
  open: string,
  close: string,
  statements: readonly string[],
  maxLineLen: number,
): string[] => {
  const maxBodyLen = maxLineLen - open.length - close.length;
  return chunkMolangStatements(statements, maxBodyLen).map(
    (body) => `${open}${body}${close}`,
  );
};
