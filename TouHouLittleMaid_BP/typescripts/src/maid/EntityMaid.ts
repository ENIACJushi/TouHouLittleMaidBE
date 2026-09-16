/**
 * 女仆实体公开聚合 API（嵌套风格：EntityMaid.Work.set(entity, …)）。
 * 包外请从 `maid/main` 导入本符号；maid 模块内部可 `from "../EntityMaid"`。
 * 仅转发 facets / serialize，不写业务。
 */
import {
  Backpack,
  Emote,
  Food,
  Health,
  Home,
  Init,
  Kill,
  Level,
  Movement,
  Mute,
  Owner,
  PackedState,
  Pick,
  Pose,
  Ride,
  Skin,
  Sound,
  Statues,
  Util,
  Work,
} from "./facets/main";
import { fromStr, toLore, toStr } from "./serialize/entityCodec";

/** 嵌套静态 API，便于按领域发现能力 */
export class EntityMaid {
  static Owner = Owner;
  static Health = Health;
  static Level = Level;
  static Kill = Kill;
  static Mute = Mute;
  static Work = Work;
  static Movement = Movement;
  static Home = Home;
  static Pick = Pick;
  static Backpack = Backpack;
  static PackedState = PackedState;
  static Pose = Pose;
  static Food = Food;
  static Emote = Emote;
  static Sound = Sound;
  static Skin = Skin;
  static Ride = Ride;
  static Statues = Statues;
  static Init = Init;
  static Util = Util;

  /** @deprecated 请用 Init.dynamicProperties */
  static initDynamicProperties = Init.dynamicProperties.bind(Init);
  /** @deprecated 请用 Init.maid */
  static init_maid = Init.maid.bind(Init);

  static toStr = toStr;
  static fromStr = fromStr;
  static toLore = toLore;

  /** @deprecated 请用 Util.* / Pose.* / Food.* */
  static formatOutput = Util.formatOutput.bind(Util);
  static getNameTag = Util.getNameTag.bind(Util);
  static isSafeBlock = Util.isSafeBlock.bind(Util);
  static despawn = Util.despawn.bind(Util);
  static playSound = Util.playSound.bind(Util);
  static spawnRandomMaid = Util.spawnRandomMaid.bind(Util);

  static isSitting = Pose.isSitting.bind(Pose);
  static setSitting = Pose.setSitting.bind(Pose);
  static isHug = Pose.isHug.bind(Pose);
  static setHug = Pose.setHug.bind(Pose);
  static isSleeping = Pose.isSleeping.bind(Pose);
  static setSleeping = Pose.setSleeping.bind(Pose);
  static sitDown = Pose.sitDown.bind(Pose);
  static standUp = Pose.standUp.bind(Pose);
}
