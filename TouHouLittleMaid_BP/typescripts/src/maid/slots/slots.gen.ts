/**
 * 由 MaidGenerator 自动同步（在 MaidGenerator 目录执行 npm run build）。
 *
 * 用途：BP 脚本侧槽位 min/max/step 与 JSON 展开保持一致，便于人工对照与临时改数值。
 * - 持久修改：改 MaidGenerator/modules/slots/*（或 Skin 的 variant 区间）后重新 build（会覆盖本文件，并更新 maid.json）
 * - 临时修改：可直接改下方数字；下次 build 会覆盖，且不会自动改 maid.json / 不会自动 tsc
 *
 * 本文件不要手写业务逻辑；仅存放生成的数值表。
 */

/** 与脚本 IntSlotDef 对齐的生成结构（step 恒有显式值） */
export type GeneratedIntSlotDef = {
  id: string;
  kind: "int";
  min: number;
  max: number;
  step: number;
};

/** 槽位 attack：2~32 step=2 */
export const ATTACK_SLOT: GeneratedIntSlotDef = {
  id: "attack",
  kind: "int",
  min: 2,
  max: 32,
  step: 2,
};

/** 槽位 health：20~100 step=2 */
export const HEALTH_SLOT: GeneratedIntSlotDef = {
  id: "health",
  kind: "int",
  min: 20,
  max: 100,
  step: 2,
};

/** 槽位 knockback：0~100 step=2 */
export const KNOCKBACK_SLOT: GeneratedIntSlotDef = {
  id: "knockback",
  kind: "int",
  min: 0,
  max: 100,
  step: 2,
};

/** 槽位 variant：0~200 step=1 */
export const VARIANT_SLOT: GeneratedIntSlotDef = {
  id: "variant",
  kind: "int",
  min: 0,
  max: 200,
  step: 1,
};

/** 已同步整型槽索引 */
export const INT_SLOTS: Readonly<Record<string, GeneratedIntSlotDef>> = {
  [ATTACK_SLOT.id]: ATTACK_SLOT,
  [HEALTH_SLOT.id]: HEALTH_SLOT,
  [KNOCKBACK_SLOT.id]: KNOCKBACK_SLOT,
  [VARIANT_SLOT.id]: VARIANT_SLOT,
};
