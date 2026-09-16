/**
 * 女仆实体公开聚合 API（嵌套风格：EntityMaid.Work.set(entity, …)）。
 * 包外请从 `maid/main` 导入本符号；maid 模块内部可 `from "../EntityMaid"`。
 * 仅转发 facets / serialize，不写业务。
 */
import {
  Anim,
  Backpack,
  Emote,
  Health,
  Home,
  Kill,
  Level,
  Movement,
  Mute,
  Owner,
  Pick,
  Ride,
  Skin,
  Sound,
  Statues,
  Work,
  despawn,
  formatOutput,
  getFoodLevel,
  getNameTag,
  initDynamicProperties,
  init_maid,
  isHug,
  isSafeBlock,
  isSitting,
  isSleeping,
  playSound,
  setFoodLevel,
  setHug,
  setSitting,
  setSleeping,
  sitDown,
  spawnRandomMaid,
  standUp,
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
  static Anim = Anim;
  static Emote = Emote;
  static Sound = Sound;
  static Skin = Skin;
  static Ride = Ride;
  static Statues = Statues;

  static initDynamicProperties = initDynamicProperties;
  static init_maid = init_maid;

  static toStr = toStr;
  static fromStr = fromStr;
  static toLore = toLore;

  static formatOutput = formatOutput;
  static getNameTag = getNameTag;
  static isSafeBlock = isSafeBlock;
  static despawn = despawn;
  static playSound = playSound;
  static spawnRandomMaid = spawnRandomMaid;

  static isSitting = isSitting;
  static setSitting = setSitting;
  static isHug = isHug;
  static setHug = setHug;
  static isSleeping = isSleeping;
  static setSleeping = setSleeping;
  static getFoodLevel = getFoodLevel;
  static setFoodLevel = setFoodLevel;
  static sitDown = sitDown;
  static standUp = standUp;
}
