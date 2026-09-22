import { Entity, WorldSoundOptions } from "@minecraft/server";
import {MaidSoundType} from "./MaidSoundType";

/**
 * 音效类型 → `TouHouLittleMaid_RP/sounds/sound_definitions.json` 中的播放 key。
 * 当前与内置定义一一对应；音效包接入后可在此表或旁路覆写层加入 packId。
 */
export const MAID_SOUND_KEYS: Readonly<Record<MaidSoundType, string>> = {
  [MaidSoundType.Death]: "mob.thlmm.maid.death",
  [MaidSoundType.FindTarget]: "mob.thlmm.maid.find_target",
  [MaidSoundType.HurtPlayer]: "mob.thlmm.maid.hurt_player",
  [MaidSoundType.Hurt]: "mob.thlmm.maid.hurt",
  [MaidSoundType.ItemGet]: "mob.thlmm.maid.item_get",
  [MaidSoundType.Tamed]: "mob.thlmm.maid.tamed",

  [MaidSoundType.Cold]: "mob.thlmm.maid.cold",
  [MaidSoundType.Hot]: "mob.thlmm.maid.hot",
  [MaidSoundType.Morning]: "mob.thlmm.maid.morning",
  [MaidSoundType.Night]: "mob.thlmm.maid.night",
  [MaidSoundType.Rain]: "mob.thlmm.maid.rain",
  [MaidSoundType.Snow]: "mob.thlmm.maid.snow",

  [MaidSoundType.Attack]: "mob.thlmm.maid.attack",
  [MaidSoundType.Feed]: "mob.thlmm.maid.feed",
  [MaidSoundType.Idle]: "mob.thlmm.maid.idle",

  [MaidSoundType.Credit]: "mob.thlmm.maid.credit",
  [MaidSoundType.CameraUse]: "thlm.camera_use",
  [MaidSoundType.Box]: "thlm.box",
};

/**
 * 播放音效时的可选参数。
 * 字段对齐 `@minecraft/server` 的 {@link WorldSoundOptions}，便于直接传给 `dimension.playSound`。
 */
export interface MaidSoundPlayOptions {
  /** 音高；引擎要求 >= 0.01 */
  pitch?: number;
  /** 音量；引擎要求 >= 0 */
  volume?: number;
  /** 是否广播（API beta） */
  isBroadcast?: boolean;
  /**
   * 额外循环次数：`0` 播一次，`-1` 无限循环，正整数 N 共播 N+1 次。
   */
  loopCount?: number;
}

/**
 * 女仆音效管理器：类型枚举 ↔ sound_definitions key，并统一底层播放。
 * 使用场景：maid 包内由 Sound facet 委托调用；静音策略由调用方 / Sound facet 决定（本管理器不自动查 mute）。
 *
 * **包外请勿直接调用**——对外唯一入口是 `EntityMaid.Sound`（facets）。
 */
export const MaidSoundManager = {
  /**
   * 查询类型对应的 sound_definitions key。
   */
  getKey(type: MaidSoundType): string {
    return MAID_SOUND_KEYS[type];
  },

  /**
   * 在女仆位置播放指定类型音效。
   * @param maid 女仆实体（取 dimension / location）
   * @param type 音效类型枚举
   * @param options 可选 pitch / volume 等
   */
  play(maid: Entity, type: MaidSoundType, options?: MaidSoundPlayOptions): void {
    const key = this.getKey(type);
    const soundOptions: WorldSoundOptions | undefined = options === undefined
      ? undefined
      : {
          pitch: options.pitch,
          volume: options.volume,
          isBroadcast: options.isBroadcast,
          loopCount: options.loopCount,
        };
    maid.dimension.playSound(key, maid.location, soundOptions);
  },
};
