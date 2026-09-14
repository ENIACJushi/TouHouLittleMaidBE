import { Block, Dimension, Entity, Vector3 } from "@minecraft/server";
import { Backpack } from "./Backpack";
import { Health } from "./Health";
import { Kill } from "./Kill";
import { Level } from "./Level";
import { Mute } from "./Mute";
import { Owner } from "./Owner";
import { Pick } from "./Pick";
import { Work } from "./Work";

/**
 * 格式化输出 rawtext（对齐 EntityMaid.formatOutput）
 */
export function formatOutput(maid: Entity): object[] {
  let rawtext: object[] = [];
  // 标题
  rawtext.push({ "translate": "message.tlm.admin.maid_info" });
  rawtext.push({ "text": "\n" });
  // 女仆名称
  rawtext.push({ "translate": "message.tlm.admin.maid.name" });
  rawtext.push({ "text": `${getNameTag(maid)}\n` });
  // 主人名称
  rawtext.push({ "translate": "message.tlm.admin.maid.owner.name" });
  rawtext.push({ "text": `${Owner.getName(maid)}\n` });
  // 主人ID
  rawtext.push({ "translate": "message.tlm.admin.maid.owner.id" });
  rawtext.push({ "text": `${Owner.getID(maid)}\n` });
  // 等级
  rawtext.push({ "translate": "message.tlm.admin.maid.level" });
  rawtext.push({ "text": `${Level.get(maid)}\n` });
  // 杀敌数
  rawtext.push({ "translate": "message.tlm.admin.maid.kill" });
  rawtext.push({ "text": `${Kill.get(maid)}\n` });
  // 生命值
  rawtext.push({ "translate": "message.tlm.admin.maid.health" });
  rawtext.push({ "text": `${Health.get(maid)}/${Health.getMax(maid)}\n` });
  // 工作模式
  rawtext.push({ "translate": "message.tlm.admin.maid.work" });
  rawtext.push({ "text": `${Work.getName(Work.get(maid))}\n` });
  // 隐藏背包
  rawtext.push({ "translate": "message.tlm.admin.maid.backpack" });
  rawtext.push({ "text": `${Backpack.getInvisible(maid)}\n` });
  // 拾物模式
  rawtext.push({ "translate": "message.tlm.admin.maid.pick" });
  rawtext.push({ "text": `${Pick.get(maid)}\n` });
  // 静音模式
  rawtext.push({ "translate": "message.tlm.admin.maid.mute" });
  rawtext.push({ "text": `${Mute.get(maid)}\n` });

  return rawtext;
}

/**
 * 判断一个方块是否安全（用于放置女仆）
 */
export function isSafeBlock(block: Block | undefined): boolean {
  if (block === undefined || block.isAir) return true;
  return false;
}

/**
 * 获取名称（查包模式时返回隐藏的真实名）
 */
export function getNameTag(maid: Entity): string {
  if (Backpack.isCheckMode(maid)) {
    let name = maid.getDynamicProperty("name");
    return name === undefined ? "" : name as string;
  }
  return maid.nameTag;
}

/**
 * 移除女仆实体（对齐 EntityMaid.despawn）
 */
export function despawn(maid: Entity): void {
  maid.triggerEvent("despawn");
}

/**
 * 播放声音（对齐 EntityMaid.playSound）
 */
export function playSound(maid: Entity, name: string): void {
  maid.dimension.runCommand(
    `playsound ${name} @a ${maid.location.x} ${maid.location.y} ${maid.location.z}`,
  );
}

/**
 * 生成一个随机女仆（对齐 EntityMaid.spawnRandomMaid；当前仍为默认女仆）
 */
export function spawnRandomMaid(dimension: Dimension, location: Vector3): Entity {
  return dimension.spawnEntity("thlmm:maid" as any, location);
}
