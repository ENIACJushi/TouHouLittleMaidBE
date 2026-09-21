/**
 * 槽位展开工具：按约定生成 slot:<id>_<token> 组件组及成对装载/卸载事件。
 * 使用场景：MaidGenerator 批量产出脚本→JSON 原子组件挂载点，业务层不直接写事件名。
 */

/** 单次 int 槽展开数量上限，防止误配撑爆 maid.json */
const INT_SLOT_EXPAND_MAX = 256;

/**
 * 将 shape 模板中的 "$" 递归替换为 token（数字或字符串）
 * @param {*} node 组件体模板节点
 * @param {string|number} token 档位值
 * @returns {*} 替换后的深拷贝结构
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
 */
export function slotGroupName(id, token) {
  return `slot:${id}_${token}`;
}

/**
 * 卸载事件名：slot:<id>_<token>_quit
 * @param {string} id 槽位 id
 * @param {string|number} token 档位
 */
export function slotQuitEventName(id, token) {
  return `slot:${id}_${token}_quit`;
}

/**
 * 校验 slot 事件体仅含 add 或 remove（构建期断言）
 * @param {string} eventName 事件名
 * @param {object} event 事件体
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
 * 展开整型区间槽位：为 [min, max] 每一档生成组 + add/quit 事件
 * @param {object} g 生成器实例（需 addComponentGroup / addEvent）
 * @param {{
 *   id: string,
 *   min: number,
 *   max: number,
 *   component: string,
 *   shape: object,
 *   mapToken?: (token: number) => *,
 * }} def 槽位定义；mapToken 可选，将档位映射进组件字段（如 knockback 百分制→0~1）
 */
export function expandIntSlot(g, def) {
  const { id, min, max, component, shape, mapToken } = def;
  if (typeof id !== "string" || !id) {
    throw new Error("expandIntSlot: id 无效");
  }
  if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
    throw new Error(`expandIntSlot(${id}): min/max 无效 (${min}, ${max})`);
  }
  const count = max - min + 1;
  if (count > INT_SLOT_EXPAND_MAX) {
    throw new Error(`expandIntSlot(${id}): 展开数量 ${count} 超过上限 ${INT_SLOT_EXPAND_MAX}`);
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

  console.log(`展开整型槽位 ${id}: ${min}~${max} (${count} 档)`);
  for (let token = min; token <= max; token++) {
    const groupName = slotGroupName(id, token);
    const quitName = slotQuitEventName(id, token);
    const fillValue = mapToken ? mapToken(token) : token;
    const groupBody = {
      [component]: fillShape(shape, fillValue),
    };
    g.addComponentGroup(groupName, groupBody);

    const addEvent = { add: { component_groups: [groupName] } };
    const quitEvent = { remove: { component_groups: [groupName] } };
    assertPureSlotEvent(groupName, addEvent);
    assertPureSlotEvent(quitName, quitEvent);
    g.addEvent(groupName, addEvent);
    g.addEvent(quitName, quitEvent);
  }
}

/**
 * 展开枚举槽位：为 values 每一项生成组 + add/quit 事件
 * @param {object} g 生成器实例
 * @param {{ id: string, values: Array<string|number>, component: string, shape: object }} def 槽位定义
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

    const addEvent = { add: { component_groups: [groupName] } };
    const quitEvent = { remove: { component_groups: [groupName] } };
    assertPureSlotEvent(groupName, addEvent);
    assertPureSlotEvent(quitName, quitEvent);
    g.addEvent(groupName, addEvent);
    g.addEvent(quitName, quitEvent);
  }
}
