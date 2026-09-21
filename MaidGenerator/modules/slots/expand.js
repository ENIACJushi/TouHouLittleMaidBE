/**
 * 槽位展开工具：按约定生成 slot:<id>_<token> 组件组及成对装载/卸载事件。
 * 使用场景：MaidGenerator 批量产出脚本→JSON 原子组件挂载点，业务层不直接写事件名。
 *
 * 类型见 {@link ./types.js}
 */

/** 单次 int 槽展开数量上限，防止误配撑爆 maid.json */
const INT_SLOT_EXPAND_MAX = 256;

/**
 * 将 shape 模板中的 "$" 递归替换为 token（数字或字符串）
 * @param {import('./types.js').SlotShapeValue} node 组件体模板节点
 * @param {string|number|*} token 档位值（或 mapToken 结果）
 * @returns {import('./types.js').SlotShapeValue} 替换后的深拷贝结构
 */
function fillShape(node, token) {
  if (node === "$") {
    return token;
  }
  if (Array.isArray(node)) {
    return node.map((item) => fillShape(item, token));
  }
  if (node !== null && typeof node === "object") {
    const out = {};
    for (const key of Object.keys(node)) {
      out[key] = fillShape(node[key], token);
    }
    return out;
  }
  return node;
}

/**
 * 组名 / 装载事件名：slot:<id>_<token>
 * @param {string} id 槽位 id
 * @param {string|number} token 档位
 * @returns {string}
 */
export function slotGroupName(id, token) {
  return `slot:${id}_${token}`;
}

/**
 * 卸载事件名：slot:<id>_<token>_quit
 * @param {string} id 槽位 id
 * @param {string|number} token 档位
 * @returns {string}
 */
export function slotQuitEventName(id, token) {
  return `slot:${id}_${token}_quit`;
}

/**
 * 校验 slot 事件体仅含 add 或 remove（构建期断言）
 * @param {string} eventName 事件名
 * @param {import('./types.js').SlotPureEvent} event 事件体
 */
function assertPureSlotEvent(eventName, event) {
  const keys = Object.keys(event);
  if (keys.length !== 1 || (keys[0] !== "add" && keys[0] !== "remove")) {
    throw new Error(`slot 事件体不纯: ${eventName} keys=${keys.join(",")}`);
  }
  const side = event.add ?? event.remove;
  if (!side || !Array.isArray(side.component_groups) || side.component_groups.length !== 1) {
    throw new Error(`slot 事件必须恰好引用一个组件组: ${eventName}`);
  }
}

/**
 * 展开整型区间槽位：按 [min, max] 与 step 生成档位 + add/quit 事件。
 * step 默认为 1（密排）；step>1 时为步进区间，仅生成 min + k*step ≤ max。
 * @param {import('./types.js').MaidGeneratorApi} g 生成器实例
 * @param {import('./types.js').IntSlotDef} def 整型槽定义
 */
export function expandIntSlot(g, def) {
  const { id, min, max, component, shape, mapToken } = def;
  const step = def.step === undefined ? 1 : def.step;
  if (typeof id !== "string" || !id) {
    throw new Error("expandIntSlot: id 无效");
  }
  if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
    throw new Error(`expandIntSlot(${id}): min/max 无效 (${min}, ${max})`);
  }
  if (!Number.isInteger(step) || step < 1) {
    throw new Error(`expandIntSlot(${id}): step 无效 (${step})`);
  }
  /** @type {number[]} */
  const tokens = [];
  for (let token = min; token <= max; token += step) {
    tokens.push(token);
  }
  if (tokens.length === 0) {
    throw new Error(`expandIntSlot(${id}): 无有效档位`);
  }
  if (tokens.length > INT_SLOT_EXPAND_MAX) {
    throw new Error(`expandIntSlot(${id}): 展开数量 ${tokens.length} 超过上限 ${INT_SLOT_EXPAND_MAX}`);
  }
  if (typeof component !== "string" || !component) {
    throw new Error(`expandIntSlot(${id}): component 无效`);
  }
  if (shape === undefined || shape === null || typeof shape !== "object") {
    throw new Error(`expandIntSlot(${id}): shape 无效`);
  }
  if (mapToken !== undefined && typeof mapToken !== "function") {
    throw new Error(`expandIntSlot(${id}): mapToken 必须是函数`);
  }

  console.log(`展开整型槽位 ${id}: ${min}~${max} step=${step} (${tokens.length} 档)`);
  for (const token of tokens) {
    const groupName = slotGroupName(id, token);
    const quitName = slotQuitEventName(id, token);
    const fillValue = mapToken ? mapToken(token) : token;
    const groupBody = {
      [component]: fillShape(shape, fillValue),
    };
    g.addComponentGroup(groupName, groupBody);

    /** @type {import('./types.js').SlotPureEvent} */
    const addEvent = { add: { component_groups: [groupName] } };
    /** @type {import('./types.js').SlotPureEvent} */
    const quitEvent = { remove: { component_groups: [groupName] } };
    assertPureSlotEvent(groupName, addEvent);
    assertPureSlotEvent(quitName, quitEvent);
    g.addEvent(groupName, addEvent);
    g.addEvent(quitName, quitEvent);
  }
}

/**
 * 展开枚举槽位：为 values 每一项生成组 + add/quit 事件
 * @param {import('./types.js').MaidGeneratorApi} g 生成器实例
 * @param {import('./types.js').EnumSlotDef} def 枚举槽定义
 */
export function expandEnumSlot(g, def) {
  const { id, values, component, shape } = def;
  if (typeof id !== "string" || !id) {
    throw new Error("expandEnumSlot: id 无效");
  }
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error(`expandEnumSlot(${id}): values 无效`);
  }
  if (values.length > INT_SLOT_EXPAND_MAX) {
    throw new Error(`expandEnumSlot(${id}): 枚举数量超过上限 ${INT_SLOT_EXPAND_MAX}`);
  }

  console.log(`展开枚举槽位 ${id}: ${values.length} 档`);
  for (const token of values) {
    const groupName = slotGroupName(id, token);
    const quitName = slotQuitEventName(id, token);
    const groupBody = {
      [component]: fillShape(shape, token),
    };
    g.addComponentGroup(groupName, groupBody);

    /** @type {import('./types.js').SlotPureEvent} */
    const addEvent = { add: { component_groups: [groupName] } };
    /** @type {import('./types.js').SlotPureEvent} */
    const quitEvent = { remove: { component_groups: [groupName] } };
    assertPureSlotEvent(groupName, addEvent);
    assertPureSlotEvent(quitName, quitEvent);
    g.addEvent(groupName, addEvent);
    g.addEvent(quitName, quitEvent);
  }
}
