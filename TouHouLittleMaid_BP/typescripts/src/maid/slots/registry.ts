/**
 * 槽位元数据注册表：与 MaidGenerator 槽位表字段对齐（id / kind / 范围）。
 * 使用场景：SlotRuntime 校验取值；新增槽位时先改生成器再在此登记，避免漂移。
 */

/** 整型槽位定义（闭区间） */
export type IntSlotDef = {
  /** 槽位 id，进入事件名 slot:<id>_… */
  id: string;
  kind: "int";
  min: number;
  max: number;
};

/**
 * 攻击伤害槽：对应生成器 ATTACK_SLOT（minecraft:attack.damage，1~32）
 */
export const ATTACK_SLOT: IntSlotDef = {
  id: "attack",
  kind: "int",
  min: 1,
  max: 32,
};

/**
 * 最大生命槽：对应生成器 HEALTH_SLOT（minecraft:health value/max，20~100）
 */
export const HEALTH_SLOT: IntSlotDef = {
  id: "health",
  kind: "int",
  min: 20,
  max: 100,
};

/**
 * 抗击退槽：百分制 0~100 → 引擎 value = token/100（对应生成器 KNOCKBACK_SLOT）
 */
export const KNOCKBACK_SLOT: IntSlotDef = {
  id: "knockback",
  kind: "int",
  min: 0,
  max: 100,
};

/**
 * 模型 variant 槽：事件仍用历史 skin:N（见 SKIN_LEGACY_EVENTS），区间对齐 MaidGenerator Skin.js
 */
export const VARIANT_SLOT: IntSlotDef = {
  id: "variant",
  kind: "int",
  min: 0,
  max: 200,
};

/** 已注册整型槽，便于通用运行时查找 */
export const INT_SLOTS: Readonly<Record<string, IntSlotDef>> = {
  [ATTACK_SLOT.id]: ATTACK_SLOT,
  [HEALTH_SLOT.id]: HEALTH_SLOT,
  [KNOCKBACK_SLOT.id]: KNOCKBACK_SLOT,
  [VARIANT_SLOT.id]: VARIANT_SLOT,
};
