import { Entity } from "@minecraft/server";
import { DP } from "../../libs/DynamicPropertyInterface";

/**
 * 静音模式（行为对齐 EntityMaid.Mute）
 */
export const Mute = {
  /**
   * 设置模式
   */
  set(maid: Entity, value: boolean): void {
    DP.setBoolean(maid, "mute", value);
  },
  switchMode(maid: Entity): void {
    this.set(maid, !this.get(maid));
  },
  /**
   * 获取模式
   */
  get(maid: Entity): boolean {
    let res = DP.getBoolean(maid, "mute");
    if (res === undefined) {
      this.set(maid, false);
      return false;
    }
    else {
      return res;
    }
  },
  getImg(is_mute: boolean): string {
    return is_mute ? "textures/gui/mute_activate.png" : "textures/gui/mute_deactivate.png";
  },
  getLang(is_mute: boolean): string {
    return is_mute ? "gui.touhou_little_maid:button.mute.true.name" : "gui.touhou_little_maid:button.mute.false.name";
  },
};
