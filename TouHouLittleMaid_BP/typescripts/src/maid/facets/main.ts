import { Owner } from "./Owner";
import { Health } from "./Health";
import { Level } from "./Level";
import { Kill } from "./Kill";
import { Mute } from "./Mute";
import { Work } from "./Work";
import { Movement } from "./Movement";
import { Home } from "./Home";
import { Pick } from "./Pick";
import { Backpack } from "./Backpack";
import { Anim } from "./Anim";
import { Emote } from "./Emote";
import { Sound } from "./Sound";
import { Skin } from "./Skin";
import { Ride } from "./Ride";
import { Statues } from "./Statues";
import { Init } from "./init";
import { Util } from "./util";

export {
  Owner,
  Health,
  Level,
  Kill,
  Mute,
  Work,
  Movement,
  Home,
  Pick,
  Backpack,
  Anim,
  Emote,
  Sound,
  Skin,
  Ride,
  Statues,
  Init,
  Util,
};

/**
 * 可选命名空间聚合（非 Entity 包装）
 * 散落能力收在 Init / Util / Anim，不再平铺自由函数
 */
export const Maid = {
  Owner,
  Health,
  Level,
  Kill,
  Mute,
  Work,
  Movement,
  Home,
  Pick,
  Backpack,
  Anim,
  Emote,
  Sound,
  Skin,
  Ride,
  Statues,
  Init,
  Util,
};
