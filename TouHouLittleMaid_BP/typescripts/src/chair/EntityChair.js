import { Entity } from "@minecraft/server";
import { ChairSkin } from "./skin/ChairSkin";

export const CHAIR_IDENTIFIER = "touhou_little_maid:chair";
export const CHAIR_PACK_PROPERTY = "thlm:chair_pack";

/**
 * 坐垫实体辅助类
 * 与女仆（EntityMaid）相对独立，使用独立属性 `thlm:chair_pack` 记录坐垫皮肤包序号，
 * 皮肤索引通过 `minecraft:variant` 组件记录。
 */
export class EntityChair {
  static Skin = {
    /**
     * 恢复坐垫模型
     */
    recoverChairSkin(chair, pack, index) {
      EntityChair.Skin.setPack(chair, pack ?? 2);
      EntityChair.Skin.setIndex(chair, index ?? 0);
    },
    /**
     * 设置坐垫皮肤包编号
     * @param {Entity} chair 坐垫实体
     * @param {number} chair_pack 坐垫皮肤包编号
     */
    setPack(chair, chair_pack) {
      chair.setProperty(CHAIR_PACK_PROPERTY, chair_pack);
    },
    /**
     * 获取坐垫皮肤包编号
     * @param {Entity} chair 坐垫实体
     * @returns {number}
     */
    getPack(chair) {
      return chair.getProperty(CHAIR_PACK_PROPERTY);
    },
    /**
     * 设置坐垫皮肤编号（从 0 开始），直接写 `minecraft:variant` 组件
     * @param {Entity} chair 坐垫实体
     * @param {number} index 坐垫皮肤编号
     */
    setIndex(chair, index) {
      chair.triggerEvent(`skin:${index}`);
    },
    /**
     * 获取坐垫皮肤编号
     * @param {Entity} chair 坐垫实体
     * @returns {number}
     */
    getIndex(chair) {
      return chair.getComponent("minecraft:variant").value;
    },
    /**
     * 随机设置一个坐垫皮肤
     * @param {Entity} chair 坐垫实体
     */
    setRandom(chair) {
      let target = ChairSkin.getRandom();
      this.setPack(chair, target.pack);
      this.setIndex(chair, target.seq);
    },
  };
}
