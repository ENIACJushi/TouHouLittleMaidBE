/**
 * 实体 ↔ 女仆字符串 / lore 编排
 * 从 EntityMaid.toStr / fromStr / toLore 迁出；内部只调 facets + StrMaid。
 */

import {
  Dimension,
  Entity,
  EntityHealthComponent,
  EntityTameableComponent,
  Player,
  system,
  Vector3,
  world,
} from "@minecraft/server";
import { str2Lore } from "../../libs/ScarletToolKit";
import { Pose } from "../facets/Pose";
import { Backpack } from "../facets/Backpack";
import { Health } from "../facets/Health";
import { Init } from "../facets/init";
import { Kill } from "../facets/Kill";
import { Level } from "../facets/Level";
import { Mute } from "../facets/Mute";
import { Owner } from "../facets/Owner";
import { Pick } from "../facets/Pick";
import { Skin } from "../facets/Skin";
import { Sound } from "../facets/Sound";
import { Util } from "../facets/util";
import { Work } from "../facets/Work";
import { StrMaid } from "./StrMaid";

/**
 * 将女仆转为字符
 */
export function toStr(maid: Entity, dump: boolean = true): string {
  let maidStr = "";
  /// 记录女仆状态 ///
  // 主人id, 可为空（野生女仆）
  let o_id = Owner.getID(maid);
  if (o_id !== undefined) {
    maidStr = StrMaid.Owner.setID(maidStr, o_id);
  }
  // 等级
  maidStr = StrMaid.Level.set(maidStr, Level.get(maid)!);
  // 杀敌数
  maidStr = StrMaid.Kill.set(maidStr, Kill.get(maid));
  // 生命值（对齐旧实现：直接读 health 组件 current/default）
  let health = maid.getComponent("health") as EntityHealthComponent;
  maidStr = StrMaid.Health.set(maidStr, health.currentValue, health.defaultValue);
  // 皮肤
  maidStr = StrMaid.Skin.set(maidStr, Skin.getPack(maid), Skin.getIndex(maid));
  // 工作模式
  maidStr = StrMaid.Work.set(maidStr, Work.get(maid));
  // 拾物模式
  maidStr = StrMaid.Pick.set(maidStr, Pick.get(maid));
  // 静音模式
  maidStr = StrMaid.Mute.set(maidStr, Mute.get(maid));
  // 背包是否隐藏
  maidStr = StrMaid.backpackInvisibility.set(maidStr, Backpack.getInvisible(maid));
  // 背包等级
  maidStr = StrMaid.backpackType.set(maidStr, Backpack.getType(maid));
  // 是否坐下
  maidStr = StrMaid.Sit.set(maidStr, Pose.isSitting(maid));

  // 字符类数据最后设置
  if (o_id !== undefined) {
    // 主人名称
    maidStr = StrMaid.Str.setOwnerName(maidStr, Owner.getName(maid));
    // 女仆名称
    if (Util.getNameTag(maid) !== "") maidStr = StrMaid.Str.setMaidName(maidStr, Util.getNameTag(maid));
  }

  // 爆出物品
  if (dump) Backpack.dump(maid);

  return maidStr;
}

/**
 * 将字符转为女仆；由照片、魂符放出的女仆不会回满血
 */
export function fromStr(
  maidStr: string,
  dimension: Dimension,
  location: Vector3,
  set_health: boolean = false,
): Entity | undefined {
  /// 数据合法性校验 ///
  // 若有主人 则主人必须在世界中
  let ownerID = StrMaid.Owner.getId(maidStr);
  let ownerName = StrMaid.Str.getOwnerName(maidStr);
  let ownerEntity: Entity | undefined = undefined;
  let hasOwner = false;
  if (ownerID !== undefined) {
    hasOwner = true;
    ownerEntity = world.getEntity(ownerID);
  }
  if (ownerEntity === undefined && ownerName !== undefined) {
    hasOwner = true;
    ownerEntity = world.getPlayers({ "name": ownerName })[0];
  }
  if (hasOwner && ownerEntity === undefined) {
    return undefined;
  }

  /// 生成女仆 ///
  var maid = dimension.spawnEntity("thlmm:maid" as any, location);
  Init.maid(maid, true);

  /// 设置状态 ///
  // 等级
  Level.set(maid, StrMaid.Level.get(maidStr)!);
  // 杀敌数
  Kill.set(maid, StrMaid.Kill.get(maidStr)!);
  // 主人ID  可为空  非空时主人必须在世界中
  if (ownerID !== undefined) Owner.setID(maid, ownerID);
  // 生命值  延时设置，等待 level 调血
  if (set_health) {
    system.runTimeout(() => {
      Health.set(maid, StrMaid.Health.get(maidStr)!.current);
    }, 2);
  }
  // 皮肤
  let skin = StrMaid.Skin.get(maidStr);
  Skin.setPack(maid, skin.pack);
  Skin.setIndex(maid, skin.index);
  // 工作模式 驯服成功后才会恢复
  maid.setDynamicProperty("temp_work", StrMaid.Work.get(maidStr));
  // 拾物模式
  Pick.set(maid, StrMaid.Pick.get(maidStr));
  // 静音模式
  Mute.set(maid, StrMaid.Mute.get(maidStr));
  // 背包是否隐藏（对齐旧实现：可能传入 undefined）
  Backpack.setInvisible(maid, StrMaid.backpackInvisibility.get(maidStr) as boolean);
  // 背包类型
  let backpackType = StrMaid.backpackType.get(maidStr);
  if (backpackType !== undefined && backpackType > 0 && backpackType <= 3) {
    Backpack.setType(maid, backpackType);
  }

  // 字符数据
  // 女仆名称
  let maidName = StrMaid.Str.getMaidName(maidStr);
  if (maidName !== undefined) { maid.nameTag = maidName; }
  // 主人名称
  if (ownerName !== undefined) { Owner.setName(maid, ownerName); }

  // 设置主人
  if (hasOwner) {
    Sound.disableTamed(maid);
    system.runTimeout(() => {
      (maid.getComponent("tameable") as EntityTameableComponent).tame(ownerEntity as Player);
    }, 1); // 等待女仆属性设置完成
  }

  // 设置坐下状态
  if (StrMaid.Sit.get(maidStr)) {
    system.runTimeout(() => {
      try {
        if (maid !== undefined) {
          Pose.sitDown(maid);
        }
      }
      catch { }
    }, 3);
  }
  return maid;
}

/**
 * 将女仆转为物品 lore；会按 dump 决定是否清除背包
 */
export function toLore(maid: Entity, dump: boolean = true): string[] {
  let strPure = toStr(maid, dump);
  return str2Lore(strPure);
}
