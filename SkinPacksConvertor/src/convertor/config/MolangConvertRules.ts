/**
 * Molang 转换规则
 */

/** variable 转换规则：按字段名前缀匹配。 */
export type MolangVariableResolveRule =
  | {name: string; type: 'keep'}
  | {name: string; type: 'replace'; value: string; positionValue?: string};

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
  // 尾巴弹簧目标：写在 pre_parallel 的 molang，却被更早转换的 parallel timeline 引用
  {name: 'tail', type: 'keep'},
  {name: 'player_size', type: 'replace', value: '1'}, // 大小固定为 1
  // ysm 适配变量
  {name: 'ysm_is_close_eyes', type: 'keep'}, // ysm 闭眼变量，ysm.is_close_eyes 将会引导至此
  {name: 'ysm_blink_at', type: 'keep'}, // 下次闭眼的 life_time 时刻
  {name: 'ysm_roaming_', type: 'keep'}, // YSM 配饰扁平变量（由 v.roaming.xxx 转换）
  // tlm 适配变量
  {name: 'tlm_is_sitting', type: 'keep'}, // tlm 坐下变量
  {name: 'tlm_is_hug', type: 'keep'}, // tlm 抱起变量
  {name: 'tlm_is_sleep', type: 'keep'}, // tlm 睡觉变量（thlm:anim bit2）
  {name: 'tlm_food_level', type: 'keep'}, // tlm 饥饿值（thlm:anim bit3~7，0~20）
  {name: 'tlm_anim', type: 'keep'}, // tlm 压缩位标志原值
  {name: 'tlm_is_gecko', type: 'keep'}, // tlm gecko 模型标记
  {name: 'tlm_suppress_molang_blink', type: 'keep'}, // sit/idle 自带眨眼时抑制 pre_parallel molang 眨眼
];

/**
 * `tlm.` 单段字段的转换规则
 *
 * - `keep`：原样保留
 * - `replace`：替换为 `value`
 *
 * `name` 为前缀，按 `startsWith` 匹配；先匹配到的规则生效。
 */
export const MOLANG_TLM_RESOLVE_RULES: readonly MolangVariableResolveRule[] = [
  {name: 'has_backpack', type: 'replace', value: "(q.property('thlm:backpack_type')!=0)"},
  {name: 'is_sitting', type: 'replace', value: 'v.tlm_is_sitting'},
  {name: 'is_hug', type: 'replace', value: 'v.tlm_is_hug'},
  {name: 'food_level', type: 'replace', value: 'v.tlm_food_level'},
];

/**
 * `ysm.` 单段字段的转换规则
 *
 * - `keep`：原样保留
 * - `replace`：替换为 `value`
 *
 * `name` 为前缀，按 `startsWith` 匹配；先匹配到的规则生效。
 */
export const MOLANG_YSM_RESOLVE_RULES: readonly MolangVariableResolveRule[] = [
  {name: 'food_level', type: 'replace', value: 'v.tlm_food_level'},
  {name: 'is_sleep', type: 'replace', value: 'v.tlm_is_sleep'},
  {name: 'is_close_eyes', type: 'replace', value: 'v.ysm_is_close_eyes'},
  // YSM 抬头为正；基岩 target_x 抬头为负。括号避免运算符粘连。
  {name: 'head_pitch', type: 'replace', value: '(-query.target_x_rotation)'},
  // 旋转：头-身 yaw。位置：瞳孔取反并限制余光，避免叠 look_at。
  {name: 'head_yaw', type: 'replace', value: '(math.clamp(query.target_y_rotation,-80,80))', positionValue: '(-math.clamp(query.target_y_rotation,-30,30))'},
];
