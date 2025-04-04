
import { ItemStack, PlayerInteractWithBlockBeforeEvent, EnchantmentTypes, ItemUseBeforeEvent, Player } from "@minecraft/server";
import { GeneralBulletType } from "../danmaku/shapes/main";


export class Gohei {
  static goheiSequence = Object.freeze([
    GeneralBulletType.PELLET,
    GeneralBulletType.BALL,
    GeneralBulletType.ORBS,
    GeneralBulletType.BIG_BALL,
    GeneralBulletType.BUBBLE,
    GeneralBulletType.HEART,
    GeneralBulletType.AMULET,
    // GeneralBulletType.STAR, 用八卦炉发射
    // GeneralBulletType.BIG_STAR, 用八卦炉发射
    GeneralBulletType.GLOWEY_BALL,
  ]);
  static goheiPrefix = "touhou_little_maid:hakurei_gohei_";
  static goheiDefault = GeneralBulletType.PELLET;
  /**
   * 激活由工作台合成的御币
   */
  static activate(pl?: Player) {
    try {
      if (!pl) {
        return;
      }
      let slot = pl.selectedSlotIndex;
      let container = pl.getComponent("inventory")?.container;
      if (!container) {
        return;
      }
      
      let item = container?.getItem(slot);

      if (item && item.typeId == this.goheiPrefix + "crafting_table") {
        let itemStack = new ItemStack(this.goheiPrefix + GeneralBulletType.getName(this.goheiDefault), 1);
        let ench_list = itemStack.getComponent("minecraft:enchantable");
        if(!ench_list) {
          return;
        }
        ench_list.addEnchantment({ type: EnchantmentTypes.get("infinity")!, level: 1 });
        container.setItem(slot, itemStack);
      }
    }
    catch { }
  }

  /**
   * 切换御币弹种
   * @param ev 
   * @param danmakuName 去除前缀的物品名称，如 touhou_little_maid:hakurei_gohei_crafting_table → crafting_table
   */
  static transform(ev: PlayerInteractWithBlockBeforeEvent, danmakuName: string) {
    let origin_item = ev.itemStack;
    if (!origin_item) {
      return;
    }
    if (danmakuName === "crafting_table") {
      this.activate(ev.player);
    }
    else {
      for (let i = 0; i < this.goheiSequence.length; i++) {
        let name = GeneralBulletType.getName(this.goheiSequence[i]);
        if (name === danmakuName) {
          // Get index
          let index = i + 1;
          if (index >= this.goheiSequence.length) index = 0;

          // Create item
          let itemStack = new ItemStack(this.goheiPrefix + GeneralBulletType.getName(this.goheiSequence[index]), 1);
          itemStack.getComponent("minecraft:enchantable")!.addEnchantments(
            origin_item.getComponent("minecraft:enchantable")!.getEnchantments()
          );
          itemStack.getComponent("minecraft:durability")!.damage = origin_item.getComponent("minecraft:durability")!.damage;
          itemStack.setLore(origin_item.getLore());
          itemStack.nameTag = origin_item.nameTag;

          // Set item
          let player = ev.player;
          if(!player) {
            return;
          }
          player.getComponent("inventory")?.container?.setItem(player.selectedSlotIndex, itemStack);

          // Send message
          player.sendMessage({
            rawtext: [
              { translate: "message.touhou_little_maid:hakurei_gohei.switch" },
              { translate: `danmaku.${GeneralBulletType.getName(this.goheiSequence[index])}.name` }
            ]
          });
        }
      }
    }
  }
}