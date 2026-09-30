/**
 * 女仆实体公开聚合 API（嵌套风格：EntityMaid.Work.set(entity, …)）。
 * 包外请从 `maid/main` 导入本符号；maid 模块内部可 `from "../EntityMaid"`。
 * 仅转发 facets / serialize，不写业务。
 */
import {
  Backpack,
  Damage,
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
  Seek,
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
  /**
   * 驯服承伤管线（before-hurt）。
   * 使用场景：EntityEvents 订阅；护甲/饰品经 registerDamageModifier 扩展。
   */
  static Damage = Damage;
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
  /**
   * 声音（含静音 / 驯服音 / 按类型播放）。
   * 包外播音效只走本门面，例如 `EntityMaid.Sound.play(maid, EntityMaid.Sound.Type.Idle)`；
   * 勿直接 import `maid/sound`。
   */
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
  /**
   * 精准目标 Seek（allocate / mount / stamp / quit / release / resetTarget）。
   * 使用场景：Task6 独占锁定；不挂农作业务。
   */
  static Seek = Seek;

  /** 实体 ↔ 字符串 / lore 序列化入口；场景：照片、魂符、胶片等物品持久化 */
  static toStr = toStr;
  static fromStr = fromStr;
  static toLore = toLore;
}
