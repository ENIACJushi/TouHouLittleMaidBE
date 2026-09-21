/**
 * 槽位元数据注册表：类型定义 + 再导出 MaidGenerator 同步产物。
 * 使用场景：SlotRuntime / Slots.*；数值改 MaidGenerator 后 build，或临时改 slots.gen.ts。
 */
export type IntSlotDef = {
  /** 槽位 id，进入事件名 slot:<id>_…（variant 除外，用 skin:*） */
  id: string;
  kind: "int";
  min: number;
  max: number;
  /**
   * 步进；缺省为 1（密排）。
   * 支持档为 min + k*step ≤ max；set 时对非精确值取 ≤ 请求值的最高支持档。
   */
  step?: number;
};

export {
  ATTACK_SLOT,
  HEALTH_SLOT,
  KNOCKBACK_SLOT,
  VARIANT_SLOT,
  INT_SLOTS,
} from "./slots.gen";
