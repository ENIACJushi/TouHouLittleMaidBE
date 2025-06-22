
import {
  ItemStack,
} from "@minecraft/server";

export namespace ItemJNbt {
  export interface ItemStackJNbt {
    name?: string; // typeId
    amount?: number; // 数量
    lore?: string[]; // lore
    nameTag?: string; // 展示名
    components?: ItemComponentsJNbt; // 暂不实现
  }

  export interface ItemComponentsJNbt {
    enchant?: Record<string, number>; // 附魔
  }

  /**
   * 将物品实例编码为物品定义
   */
  export function encodeItemStack(item: ItemStack): ItemStackJNbt {
    return {
      name: item.typeId,
      amount: item.amount,
      nameTag: item.nameTag,
      lore: item.getLore(),
    };
  }

  /**
   * 解码物品定义，得到物品实例
   */
  export function decodeItemJNbt (jNbt: ItemStackJNbt, amount?: number): ItemStack|undefined {
    if (!jNbt.name) {
      return undefined;
    }
    let item = new ItemStack(jNbt.name, jNbt.amount ?? amount ?? 1);
    item.setLore(jNbt.lore);
    item.nameTag = jNbt.nameTag;
    return item;
  }
}