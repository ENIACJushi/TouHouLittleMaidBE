import { Entity, ItemStack } from "@minecraft/server";
import { ChairSkin } from "./skin/ChairSkin";

export const CHAIR_IDENTIFIER = "touhou_little_maid:chair";
export const CHAIR_ITEM_IDENTIFIER = "touhou_little_maid:chair";
export const CHAIR_PACK_PROPERTY = "thlm:chair_pack";
/** 坐垫水平朝向（度）。末影水晶 runtime 无实体角度，靠客户端动画读此属性旋转 Root。 */
export const CHAIR_YAW_PROPERTY = "thlm:yaw";

/**
 * 坐垫实体辅助类
 * 与女仆（EntityMaid）相对独立，使用独立属性 `thlm:chair_pack` 记录坐垫皮肤包序号，
 * 皮肤索引通过 `minecraft:variant` 组件记录。
 * 朝向通过 `thlm:yaw` 属性同步，由客户端动画驱动模型旋转。
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

  static Rotation = {
    /**
     * 设置坐垫水平朝向（度），写入客户端同步属性供动画使用
     * @param {Entity} chair 坐垫实体
     * @param {number} yaw 朝向 yaw，与 Minecraft 实体 yaw 同约定
     */
    setYaw(chair, yaw) {
      // 规范化到 (-180, 180]，避免超出属性范围
      let normalized = ((yaw % 360) + 360) % 360;
      if (normalized > 180) normalized -= 360;
      // float 属性默认常用非 0 哨兵；精确 0 时写一个极小值，保证客户端能读到变化
      if (normalized === 0) normalized = 0.01;
      chair.setProperty(CHAIR_YAW_PROPERTY, normalized);
    },
    /**
     * 获取坐垫水平朝向
     * @param {Entity} chair 坐垫实体
     * @returns {number}
     */
    getYaw(chair) {
      return chair.getProperty(CHAIR_YAW_PROPERTY);
    },
  };
}
