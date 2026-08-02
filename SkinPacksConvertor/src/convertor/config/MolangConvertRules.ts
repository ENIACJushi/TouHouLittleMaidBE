/**
 * Molang 转换规则
 */

/** variable 转换规则：按字段名前缀匹配。 */
export type MolangVariableResolveRule =
  | {name: string; type: 'keep'}
  | {name: string; type: 'replace'; value: string};

/**
 * `v.` / `variable.` 单段字段的转换规则
 *
 * - `keep`：原样保留
 * - `replace`：替换为 `value`
 *
 * `name` 为前缀，按 `startsWith` 匹配；先匹配到的规则生效。
 */
export const MOLANG_VARIABLE_RESOLVE_RULES: readonly MolangVariableResolveRule[] = [
  {name: 'exp', type: 'keep'},
  {name: 'tcos0', type: 'keep'},
  {name: 'walk_process', type: 'keep'},
  {name: 'gliding_speed_value', type: 'keep'},
  {name: 'emote_index', type: 'keep'},
  {name: 'emote_frame', type: 'keep'},
  {name: 'emote_speed', type: 'keep'},
  {name: 'scale', type: 'keep'},
  {name: 'biaoqing', type: 'keep'},
  {name: 'animate_', type: 'keep'},
  {name: 'player_size', type: 'replace', value: '1'}, // 大小固定为 1
];
