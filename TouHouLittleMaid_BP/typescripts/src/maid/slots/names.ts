/**
 * 槽位事件名公式：与 MaidGenerator modules/slots/expand.js 保持一致。
 * 使用场景：脚本运行时拼装 slot:* 装载/卸载事件，业务层不得手写字符串。
 */

/**
 * 组件组名 / 装载事件名：slot:<id>_<token>
 */
export function slotMountEvent(id: string, token: string | number): string {
  return `slot:${id}_${token}`;
}

/**
 * 卸载事件名：slot:<id>_<token>_quit
 */
export function slotQuitEvent(id: string, token: string | number): string {
  return `slot:${id}_${token}_quit`;
}

/**
 * 记录当前档位的 DynamicProperty 键
 */
export function slotDpKey(id: string): string {
  return `slot_${id}`;
}
