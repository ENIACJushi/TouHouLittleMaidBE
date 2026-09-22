import { Entity } from "@minecraft/server";
import { DP } from "../../libs/DynamicPropertyInterface";
import {
  MaidSoundManager,
  MaidSoundPlayOptions,
  MaidSoundType,
} from "../sound/main";

/**
 * 女仆音效与静音（门面）。
 *
 * **包外 / 跨模块播音效的唯一入口**（经 `EntityMaid.Sound` 暴露；勿直接 import `maid/sound`）。
 * 新播放走 {@link play}（枚举 + 管理器）；{@link playSound} 保留原始 key 命令播放，供迁移过渡。
 */
export const Sound = {
  /** 音效类型枚举（转发；包外用 EntityMaid.Sound.Type，勿直接依赖 sound/） */
  Type: MaidSoundType,

  /**
   * 取消驯服语音
   */
  disableTamed(maid: Entity): void {
    maid.setDynamicProperty("sound:disable_tamed", true);
  },
  tamed(maid: Entity): void {
    if (maid.getDynamicProperty("sound:disable_tamed") === true) {
      maid.setDynamicProperty("sound:disable_tamed");
      return;
    }
    this.play(maid, MaidSoundType.Tamed);
  },
  /**
   * 按音效类型播放（委托 {@link MaidSoundManager}；不自动检查静音）
   * @param maid 女仆实体
   * @param type 音效类型
   * @param options 可选 pitch / volume 等
   */
  play(maid: Entity, type: MaidSoundType, options?: MaidSoundPlayOptions): void {
    MaidSoundManager.play(maid, type, options);
  },
  /**
   * 播放声音（原始 sound_definitions key；不自动检查静音；调用方自行判断）
   * 保留原 `playsound` 命令实现，避免迁移期行为回退。
   */
  playSound(maid: Entity, name: string): void {
    maid.dimension.runCommand(
      `playsound ${name} @a ${maid.location.x} ${maid.location.y} ${maid.location.z}`,
    );
  },

  // ——— 静音（原 Mute facet） ———

  /**
   * 设置静音模式
   */
  setMute(maid: Entity, value: boolean): void {
    DP.setBoolean(maid, "mute", value);
  },
  /**
   * 切换静音模式
   */
  switchMute(maid: Entity): void {
    this.setMute(maid, !this.getMute(maid));
  },
  /**
   * 获取静音模式
   */
  getMute(maid: Entity): boolean {
    let res = DP.getBoolean(maid, "mute");
    if (res === undefined) {
      this.setMute(maid, false);
      return false;
    }
    else {
      return res;
    }
  },
  getMuteImg(is_mute: boolean): string {
    return is_mute ? "textures/gui/mute_activate.png" : "textures/gui/mute_deactivate.png";
  },
  getMuteLang(is_mute: boolean): string {
    return is_mute ? "gui.touhou_little_maid:button.mute.true.name" : "gui.touhou_little_maid:button.mute.false.name";
  },
};

export { MaidSoundType, MaidSoundManager };
export type { MaidSoundPlayOptions };
