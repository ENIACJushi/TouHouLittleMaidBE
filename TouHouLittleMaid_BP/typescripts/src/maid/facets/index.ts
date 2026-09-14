import { Owner } from "./Owner";
import { Health } from "./Health";
import { Level } from "./Level";
import { Kill } from "./Kill";
import { Mute } from "./Mute";

export { Owner, Health, Level, Kill, Mute };

/** 可选命名空间聚合（非 Entity 包装） */
export const Maid = { Owner, Health, Level, Kill, Mute };
