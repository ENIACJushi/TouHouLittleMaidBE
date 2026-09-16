import { Entity } from "@minecraft/server";
import { DP } from "../../libs/DynamicPropertyInterface";
import { dim_int2string, dim_string2int } from "../../libs/ScarletToolKit";
import { PackedState } from "./PackedState";

/**
 * 家模式与家坐标 DP（行为对齐 EntityMaid.Home）
 */
export const Home = {
  /**
   * 获取 home 模式
   */
  getMode(maid: Entity): boolean {
    return maid.getProperty("thlm:home") as boolean;
  },
  /**
   * 切换 home 模式
   */
  switchMode(maid: Entity): void {
    if (this.getMode(maid) === true) {
      // 家模式 → 跟随模式
      maid.setProperty("thlm:home", false);
      maid.triggerEvent(PackedState.isSitting(maid)
        ? "api:status_follow_sit"
        : "api:status_follow_stand");
    }
    else {
      // 跟随模式 → 家模式
      this.setLocation(maid);
      maid.triggerEvent("api:status_home");
    }
  },
  getImg(is_open: boolean): string {
    return is_open ? "textures/gui/home_activate.png" : "textures/gui/home_deactivate.png";
  },
  getLang(is_open: boolean): string {
    return is_open
      ? "gui.touhou_little_maid:button.home.true.name"
      : "gui.touhou_little_maid:button.home.false.name";
  },
  /**
   * 设置家为当前位置
   */
  setLocation(maid: Entity): void {
    let l = maid.location;
    DP.setVector(maid, "home", { x: l.x, y: l.y, z: l.z });
    DP.setInt(maid, "home_dim", dim_string2int(maid.dimension.id)!);
  },
  /**
   * 获取家的位置
   * @returns [x, y, z, dimensionId] | undefined
   */
  getLocation(maid: Entity): [number, number, number, string] | undefined {
    let location = DP.getVector(maid, "home");
    if (location === undefined) return undefined;

    let dim = DP.getInt(maid, "home_dim");
    if (dim === undefined) return undefined;

    let x = location.x;
    let y = location.y;
    let z = location.z;
    if (x === 0 && y === 0 && z === 0 && dim === 0) return undefined;
    return [x, y, z, dim_int2string(dim)!];
  },
};
