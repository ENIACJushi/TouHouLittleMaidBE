import { Entity } from "@minecraft/server";

/**
 * 女仆音效（行为对齐 EntityMaid.Sound）
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
   * 播放声音
   */
  playSound(maid: Entity, name: string): void {
    maid.dimension.runCommand(
      `playsound ${name} @a ${maid.location.x} ${maid.location.y} ${maid.location.z}`,
    );
  },
};
