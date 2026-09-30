import { Owner } from "./Owner";
import { Health } from "./Health";
import { Level } from "./Level";
import { Kill } from "./Kill";
import { Work } from "./Work";
import { Movement } from "./Movement";
import { Home } from "./Home";
import { Pick } from "./Pick";
import { Backpack } from "./Backpack";
import { PackedState } from "./PackedState";
import { Pose } from "./Pose";
import { Food } from "./Food";
import { Emote } from "./Emote";
import { Sound } from "./Sound";
import { Skin } from "./Skin";
import { Ride } from "./Ride";
import { Statues } from "./Statues";
import { Init } from "./init";
import { Util } from "./util";
import { Damage } from "./Damage";
import { Seek } from "./Seek";

export {
  Owner,
  Health,
  Level,
  Kill,
  Work,
  Movement,
  Home,
  Pick,
  Backpack,
  PackedState,
  Pose,
  Food,
  Emote,
  Sound,
  Skin,
  Ride,
  Statues,
  Init,
  Util,
  Damage,
  Seek,
};

/** 音效类型 / 管理器再导出：仅供 maid 包内；包外请用 EntityMaid.Sound，勿经本文件取用 sound 实现 */
export { MaidSoundType, MaidSoundManager } from "./Sound";
export type { MaidSoundPlayOptions } from "./Sound";

/**
 * 可选命名空间聚合（非 Entity 包装）
 */
export const Maid = {
  Owner,
  Health,
  Level,
  Kill,
  Work,
  Movement,
  Home,
  Pick,
  Backpack,
  PackedState,
  Pose,
  Food,
  Emote,
  Sound,
  Skin,
  Ride,
  Statues,
  Init,
  Util,
  Damage,
  Seek,
};
