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

/** 已注册整型槽，便于通用运行时查找 */
export const INT_SLOTS: Readonly<Record<string, IntSlotDef>> = {
  [ATTACK_SLOT.id]: ATTACK_SLOT,
};
