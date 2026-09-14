import { Owner } from "./Owner";
import { Health } from "./Health";
import { Level } from "./Level";
import { Kill } from "./Kill";
import { Mute } from "./Mute";
import { Work } from "./Work";
import { Movement } from "./Movement";
import { Home } from "./Home";
import { Pick } from "./Pick";

export { Owner, Health, Level, Kill, Mute, Work, Movement, Home, Pick };

/** 可选命名空间聚合（非 Entity 包装） */
export const Maid = { Owner, Health, Level, Kill, Mute, Work, Movement, Home, Pick };
