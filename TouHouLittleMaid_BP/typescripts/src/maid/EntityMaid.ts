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
  /** 主人 */
  static Owner = Owner;
  /** 生命值 */
  static Health = Health;
  /** 等级 */
  static Level = Level;
  /** 工作模式 */
  static Work = Work;
  /** 移速 */
  static Movement = Movement;
  /** 家 */
  static Home = Home;
  /** 拾物 */
  static Pick = Pick;
  /** 背包 */
  static Backpack = Backpack;
  /** 姿态 */
  static Pose = Pose;
  /** 饥饿值 */
  static Food = Food;
  /** 表情 */
  static Emote = Emote;
  /** 声音 */
  static Sound = Sound;
  /** 模型 */
  static Skin = Skin;
  /** 骑乘模式 */
  static Ride = Ride;
  /** 雕塑/手办 */
  static Statues = Statues;
  /** 女仆初始化编排（动态属性、新生成女仆） */
  static Init = Init;
  /** 压缩属性 */
  static PackedState = PackedState;
  /** 击杀数 */
  static Kill = Kill;
  /** 杂项工具（名称标签、安全方块、消散、随机生成等）；场景：通用辅助调用 */
  static Util = Util;

  /** 实体 ↔ 字符串 / lore 序列化入口；场景：照片、魂符、胶片等物品持久化 */
  static toStr = toStr;
  static fromStr = fromStr;
  static toLore = toLore;
}
