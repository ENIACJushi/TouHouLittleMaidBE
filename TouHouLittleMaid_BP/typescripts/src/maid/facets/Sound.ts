import { Entity } from "@minecraft/server";
import { DP } from "../../libs/DynamicPropertyInterface";

/**
 * 女仆音效与静音
 */
export const Sound = {
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
    this.playSound(maid, "mob.thlmm.maid.tamed");
  },
  /**
   * 播放声音（不自动检查静音；调用方自行判断）
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
