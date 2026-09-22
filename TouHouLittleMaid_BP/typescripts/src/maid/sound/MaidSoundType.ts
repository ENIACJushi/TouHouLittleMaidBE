
/**
 * 女仆音效类型（string enum）。
 * 使用场景：脚本统一点名要播哪一类语音，再经 {@link MAID_SOUND_KEYS} 落到 RP 的 sound_definitions key；
 * 后续音效包可为同一类型覆写 key（如加入 packId），调用方仍只传本枚举。
 *
 * 包外请通过 `EntityMaid.Sound.Type` 取用，勿直接依赖本文件。
 */
export enum MaidSoundType {
  // ——— AI ———
  /** 死亡 */
  Death = "death",
  /** 发现目标 */
  FindTarget = "find_target",
  /** 被玩家伤害 */
  HurtPlayer = "hurt_player",
  /** 受伤 */
  Hurt = "hurt",
  /** 拾取物品 */
  ItemGet = "item_get",
  /** 被驯服 */
  Tamed = "tamed",

  // ——— 环境 ———
  /** 寒冷 */
  Cold = "cold",
  /** 炎热 */
  Hot = "hot",
  /** 早晨 */
  Morning = "morning",
  /** 夜晚 */
  Night = "night",
  /** 下雨 */
  Rain = "rain",
  /** 下雪 */
  Snow = "snow",

  // ——— 工作模式 ———
  /** 攻击模式（切换时） */
  Attack = "attack",
  /** 喂食/繁殖模式（切换时） */
  Feed = "feed",
  /** 空闲闲聊 */
  Idle = "idle",

  // ——— 其它 ———
  /** 致谢 */
  Credit = "credit",
  /** 相机拍照 */
  CameraUse = "camera_use",
  /** 开盒 */
  Box = "box",
}
