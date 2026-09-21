/**
 * MaidGenerator 槽位系统通用 JSDoc 类型。
 * 使用场景：各槽位数据、expand / sync 参数标注；与 BP 脚本 IntSlotDef 字段对齐的运行时子集见 IntSlotRuntimeDef。
 *
 * 本文件仅导出类型（无运行时值）；通过 `import('./types.js').Xxx` 引用。
 */

/**
 * 组件体模板节点：可用字符串 `"$"` 占位，展开时替换为 token（或 mapToken 结果）
 * @typedef {string|number|boolean|null|SlotShape|Array<SlotShapeValue>} SlotShapeValue
 */

/**
 * 组件 JSON 形状（嵌套对象，字段值可为 `"$"`）
 * @typedef {Object.<string, SlotShapeValue>} SlotShape
 */

/**
 * 将档位 token 映射为写入组件的值（如 knockback 百分制→0~1）
 * @callback SlotTokenMapper
 * @param {number} token 生成/事件名中的档位
 * @returns {*} 填入 shape 的值
 */

/**
 * 脚本侧 / 同步用的整型槽运行时元数据（不含 JSON 组件细节）
 * @typedef {Object} IntSlotRuntimeDef
 * @property {string} id 槽位 id（事件名 slot:<id>_<token>）
 * @property {"int"} kind 种类固定为 int
 * @property {number} min 闭区间下界
 * @property {number} max 闭区间上界
 * @property {number} [step=1] 步进；>1 时为步进区间
 */

/**
 * 生成器侧整型槽完整定义：可 expandIntSlot，也可经 sync 抽出运行时字段
 * @typedef {Object} IntSlotDef
 * @property {string} id
 * @property {"int"} [kind="int"]
 * @property {number} min
 * @property {number} max
 * @property {number} [step=1]
 * @property {string} component Bedrock 组件名，如 minecraft:attack
 * @property {SlotShape} shape 组件体模板，`"$"` 表示填入 token/mapToken
 * @property {SlotTokenMapper} [mapToken] 可选 token→组件值映射
 */

/**
 * 生成器侧枚举槽完整定义（expandEnumSlot）
 * @typedef {Object} EnumSlotDef
 * @property {string} id
 * @property {"enum"} [kind="enum"]
 * @property {Array<string|number>} values 档位列表
 * @property {string} component
 * @property {SlotShape} shape
 * @property {SlotTokenMapper} [mapToken]
 */

/**
 * 可交给 expand 的槽位定义（整型或枚举）
 * @typedef {IntSlotDef|EnumSlotDef} SlotExpandDef
 */

/**
 * 纯事件体：仅 add 或仅 remove 一个组件组（slot 事件约束）
 * @typedef {Object} SlotPureEvent
 * @property {{ component_groups: string[] }} [add]
 * @property {{ component_groups: string[] }} [remove]
 */

/**
 * MaidGenerator 对外写入 API（expand/sync 所需最小面）
 * @typedef {Object} MaidGeneratorApi
 * @property {function(string, Object): void} addComponentGroup
 * @property {function(string, SlotPureEvent|Object): void} addEvent
 * @property {function(string, Object): void} [addProperty]
 */

export {};
