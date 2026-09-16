/**
 * 骑乘模式 UI（行为对齐 EntityMaid.Ride；逻辑尚未实现）
 */
export const Ride = {
  switchMode(_maid: unknown): void {

  },
  getImg(is_open: boolean): string {
    return is_open ? "textures/gui/ride_activate.png" : "textures/gui/ride_deactivate.png";
  },
  getLang(is_open: boolean): string {
    return is_open
      ? "gui.touhou_little_maid:button.ride.true.name"
      : "gui.touhou_little_maid:button.ride.false.name";
  },
};
