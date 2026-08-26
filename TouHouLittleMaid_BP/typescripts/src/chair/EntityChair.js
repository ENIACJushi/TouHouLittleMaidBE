import { Entity, ItemStack } from "@minecraft/server";
import { ChairSkin } from "./skin/ChairSkin";

export const CHAIR_IDENTIFIER = "touhou_little_maid:chair";
export const CHAIR_ITEM_IDENTIFIER = "touhou_little_maid:chair";
export const CHAIR_PACK_PROPERTY = "thlm:chair_pack";

/**
 * 坐垫实体辅助类
 * 与女仆（EntityMaid）相对独立，使用独立属性 `thlm:chair_pack` 记录坐垫皮肤包序号，
 * 皮肤索引通过 `minecraft:variant` 组件记录。
 */
export class EntityChair {
  static Item = {
    /**
     * 从物品 lore 解析坐垫皮肤（格式：`pack,index`）
     * @param {import("@minecraft/server").ItemStack} item
     * @returns {{ pack: number, index: number } | undefined}
     */
    parseSkin(item) {
      const lore = item.getLore();
      if (lore === undefined || lore.length === 0) {
        return undefined;
      }
      const parts = lore[0].split(",");
      if (parts.length < 2) {
        return undefined;
      }
      const pack = Number(parts[0]);
      const index = Number(parts[1]);
      if (!Number.isInteger(pack) || !Number.isInteger(index)) {
        return undefined;
      }
      return { pack, index };
    },
    /**
     * 根据坐垫实体当前模型创建物品
     * @param {Entity} chair
     * @returns {ItemStack}
     */
    createFromChair(chair) {
      const item = new ItemStack(CHAIR_ITEM_IDENTIFIER, 1);
      const pack = EntityChair.Skin.getPack(chair);
      const index = EntityChair.Skin.getIndex(chair);
      item.setLore([`${pack},${index}`]);
      return item;
    },
  };

  static Skin = {
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
