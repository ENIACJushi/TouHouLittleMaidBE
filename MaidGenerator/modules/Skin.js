/** 皮肤 variant 最大下标（含）；与脚本 VARIANT_SLOT.max 同步 */
export const SKIN_END_INDEX = 200;

/**
 * 供槽位同步用的 variant 运行时定义（事件名仍为历史 skin:N，非 slot:variant_*）
 */
export const SKIN_VARIANT_SLOT = {
  id: "variant",
  kind: "int",
  min: 0,
  max: SKIN_END_INDEX,
  step: 1,
};

/**
 * 皮肤枚举（历史事件名 skin:<n>，由脚本 VariantSlot 互斥装载/卸载）
 * 使用场景：模型 variant 切换；卸载事件 skin:<n>_quit 供槽位运行时先卸后装。
 */
export class Skin {
  /**
   * @param {MaidGenerator} g
   */
  static process(g) {
    console.log(`添加皮肤枚举: 0~${SKIN_END_INDEX}`);
    for (let i = 0; i <= SKIN_END_INDEX; i++) {
      g.addComponentGroup(`skin:${i}`, {
        "minecraft:variant": { "value": i }
      });
      g.addEvent(`skin:${i}`, {
        "add":{"component_groups":[`skin:${i}`]}
      });
      // 与槽位约定对称的卸载事件（仍用 skin: 前缀，不迁 slot:）
      g.addEvent(`skin:${i}_quit`, {
        "remove":{"component_groups":[`skin:${i}`]}
      });
    }
  }
}
