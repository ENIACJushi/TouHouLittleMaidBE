import { Container, ContainerSlot, Entity, ItemStack } from "@minecraft/server";
import { Vector } from "../../libs/VectorMC";

/**
 * 背包读写与查包模式（行为对齐 EntityMaid.Backpack）
 */
export const Backpack = {
  default: 0,
  small: 1,
  middle: 2,
  big: 3,
  capacityList: [6, 12, 24, 36],
  nameList: [
    "default",
    "small",
    "middle",
    "big",
  ],
  /**
   * 获取背包是否隐藏
   */
  getInvisible(maid: Entity): boolean {
    return maid.getProperty("thlm:backpack_invisible") as boolean;
  },
  /**
   * 设置背包是否隐藏
   */
  setInvisible(maid: Entity, value: boolean): void {
    maid.setProperty("thlm:backpack_invisible", value);
  },
  /**
   * 获取背包内容
   */
  getContainer(maid: Entity): Container | undefined {
    return maid.getComponent("inventory")?.container;
  },
  /**
   * 获取背包类型（大小）0~3
   */
  getType(maid: Entity): number {
    return maid.getProperty("thlm:backpack_type") as number;
  },
  /**
   * 设置背包类型（大小）
   */
  setType(maid: Entity, type: number): void {
    maid.triggerEvent(`api:backpack_${this.getName(type)}`);
  },

  ///// 查包管理 /////
  nameTags: [
    "§t§h§l§m§d§r",
    "§t§h§l§m§s§r",
    "§t§h§l§m§m§r",
    "§t§h§l§m§b§r",
  ],
  /**
   * 是否处于查包模式
   */
  isCheckMode(maid: Entity): boolean {
    return maid.getDynamicProperty("inv_check") === true;
  },
  /**
   * 获取查包模式的前缀
   */
  getNamePrefix(maid: Entity): string {
    return this.nameTags[this.getType(maid)];
  },
  /**
   * 主人查包模式：修改女仆的名称
   */
  checkMode(maid: Entity): boolean {
    maid.setDynamicProperty("name", maid.nameTag);
    maid.setDynamicProperty("inv_check", true);

    maid.nameTag = this.getNamePrefix(maid);
    return true;
  },
  /**
   * 退出主人查包模式
   */
  quitCheckMode(maid: Entity): boolean {
    // 未进入查包模式时 name 可能为 undefined，原生 nameTag 不允许赋 null/undefined
    let name = maid.getDynamicProperty("name");
    if (typeof name === "string") {
      maid.nameTag = name;
    }

    maid.setDynamicProperty("name");
    maid.setDynamicProperty("inv_check", false);
    return true;
  },

  ///// 辅助函数 /////
  /**
   * 添加物品，可以和现有的同种物品堆叠
   * 若全部添加成功，返回 undefined；空间不足时返回未成功添加的部分
   */
  addItem(maid: Entity, itemStack: ItemStack): ItemStack | undefined | 0 {
    let container = this.getContainer(maid);
    if (container === undefined) return 0;

    return container.addItem(itemStack);
  },
  /**
   * 移除物品；数量由 count 指定，itemStack 中的数量不被考虑
   * 若成功移除则返回 true；数量不足则返回已移除的数量（原实现返回 left）
   */
  removeItem(maid: Entity, itemStack: ItemStack, count: number): true | number | false {
    let container = this.getContainer(maid);
    if (container === undefined) return false;

    let left = count;
    for (let i = 0; i < container.size; i++) {
      let item = container.getItem(i);
      if (item !== undefined && item.isStackableWith(itemStack)) {
        // 查找成功, 移除
        if (item.amount < left) {
          left -= count;
          container.setItem(i);
        }
        else if (item.amount === left) {
          container.setItem(i);
          return true;
        }
        else {
          let afterItem = item.clone();
          afterItem.amount -= left;
          container.setItem(i, afterItem);
          return true;
        }
      }
    }
    return left;
  },
  /**
   * 按类型移除物品；数量由 count 指定
   */
  removeItem_type(maid: Entity, typeId: string, count: number): true | number | false {
    let container = this.getContainer(maid);
    if (container === undefined) return false;

    let left = count;
    for (let i = 0; i < container.size; i++) {
      let item = container.getItem(i);
      if (item !== undefined && item.typeId === typeId) {
        // 查找成功, 移除
        if (item.amount < left) {
          left -= count;
          container.setItem(i);
        }
        else if (item.amount === left) {
          container.setItem(i);
          return true;
        }
        else {
          let afterItem = item.clone();
          afterItem.amount -= left;
          container.setItem(i, afterItem);
          return true;
        }
      }
    }
    return left;
  },
  /**
   * 清除所有物品
   */
  clearAll(maid: Entity): false | void {
    let container = this.getContainer(maid);
    if (container === undefined) return false;

    container.clearAll();
  },
  /**
   * 获取某个栏位的物品
   */
  getItem(maid: Entity, slot: number): ItemStack | undefined {
    let container = this.getContainer(maid);
    if (container === undefined) return undefined;

    return container.getItem(slot);
  },
  /**
   * 获取某个栏位的对象
   */
  getSlot(maid: Entity, slot: number): ContainerSlot | undefined {
    let container = this.getContainer(maid);
    if (container === undefined) return undefined;

    return container.getSlot(slot);
  },
  /**
   * 移动物品到容器
   */
  moveItem(maid: Entity, fromSlot: number, toSlot: number, toContainer: Container): void {
    let container = this.getContainer(maid);
    if (container === undefined) return;

    container.moveItem(fromSlot, toSlot, toContainer);
  },
  /**
   * 设置某个栏位的物品
   */
  setItem(maid: Entity, slot: number, itemStack: ItemStack | undefined = undefined): void {
    let container = this.getContainer(maid);
    if (container === undefined) return;

    container.setItem(slot, itemStack);
  },
  /**
   * 与其它容器交换物品
   * 注意：旧 EntityMaid 少传 slot，此处保持同等调用形态
   */
  swapItems(maid: Entity, otherSlot: number, otherContainer: Container): void {
    let container = this.getContainer(maid);
    if (container === undefined) return;

    (container.swapItems as unknown as (a: number, b: Container) => void)(
      otherSlot,
      otherContainer,
    );
  },

  ///// 数据函数 /////
  /**
   * 获取某种类型的背包容量
   */
  getCapacity(type: number): number {
    return this.capacityList[type];
  },
  /**
   * 获取某种类型的背包名称
   */
  getName(type: number): string {
    return this.nameList[type];
  },
  /**
   * 获取某种类型的背包物品 ID
   */
  getItemName(type: number): string {
    return `touhou_little_maid:maid_backpack_${this.getName(type)}`;
  },
  /**
   * 在指定位置将背包释放
   */
  dump(maid: Entity, location: Vector | { x: number; y: number; z: number } = maid.location): void {
    // 释放包内物品
    let dimension = maid.dimension;
    let container = this.getContainer(maid);
    if (container === undefined) return;

    for (let i = 0; i < container.size; i++) {
      let item = container.getItem(i);
      if (item !== undefined) {
        dimension.spawnItem(item.clone(), location);
        container.setItem(i);
      }
    }
  },
  /**
   * 获取 UI 按钮名称
   */
  getButtonLang(invisible: boolean): string {
    return invisible
      ? "gui.touhou_little_maid:button.backpack.true.name"
      : "gui.touhou_little_maid:button.backpack.false.name";
  },
  /**
   * 获取 UI 按钮图像
   */
  getButtonImg(invisible: boolean): string {
    return invisible
      ? "textures/gui/maid_backpack_deactivate.png"
      : "textures/gui/maid_backpack_activate.png";
  },
};
