/**
 * 槽位元数据注册表：与 MaidGenerator 槽位表字段对齐（id / kind / 范围 / step）。
 * 使用场景：SlotRuntime 校验与向下取档；新增槽位时先改生成器再在此登记。
 */

/** 整型/步进区间槽位定义（闭区间，按 step 取样） */
export type IntSlotDef = {
  /** 槽位 id，进入事件名 slot:<id>_… */
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

/**
 * 攻击伤害槽：2~32 step=2（偶数档）
 */
export const ATTACK_SLOT: IntSlotDef = {
  id: "attack",
  kind: "int",
  min: 2,
  max: 32,
  step: 2,
};

/**
 * 最大生命槽：20~100 step=2（偶数档）
 */
export const HEALTH_SLOT: IntSlotDef = {
  id: "health",
  kind: "int",
  min: 20,
  max: 100,
  step: 2,
};

/**
 * 抗击退槽：百分制 0~100 step=1 → 引擎 value = token/100
 */
export const KNOCKBACK_SLOT: IntSlotDef = {
  id: "knockback",
  kind: "int",
  min: 0,
  max: 100,
  step: 1,
};

/**
 * 模型 variant 槽：事件仍用历史 skin:N；0~200 step=1
 */
export const VARIANT_SLOT: IntSlotDef = {
  id: "variant",
  kind: "int",
  min: 0,
  max: 200,
  step: 1,
};

/** 已注册整型槽，便于通用运行时查找 */
export const INT_SLOTS: Readonly<Record<string, IntSlotDef>> = {
  [ATTACK_SLOT.id]: ATTACK_SLOT,
  [HEALTH_SLOT.id]: HEALTH_SLOT,
  [KNOCKBACK_SLOT.id]: KNOCKBACK_SLOT,
  [VARIANT_SLOT.id]: VARIANT_SLOT,
};
