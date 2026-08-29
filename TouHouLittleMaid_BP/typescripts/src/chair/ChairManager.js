import {Direction, system} from "@minecraft/server";
import {CHAIR_IDENTIFIER, EntityChair} from "./EntityChair";
import * as Tool from "../libs/ScarletToolKit";
import {ChairSkin} from "./skin/ChairSkin";
import {VO} from "../libs/VectorMC";

/**
 * 坐垫放置与交互管理
 *
 * - 玩家使用 `touhou_little_maid:chair` 物品点击方块 → 在点击位置生成坐垫实体；
 * - 玩家潜行与非潜行交互坐垫 → 非潜行由坐垫实体的 `minecraft:rideable` 组件自动坐上，
 *  潜行则由实体交互事件打开模型更换表单（见 EntityEvents）；
 * - 玩家潜行攻击坐垫 → 收回为物品，并记录当前模型包与皮肤序号到物品 lore。
 *
 * 放置规则：
 * - 潜行放置：实体精准生成在玩家点击的位置，并面向玩家；
 * - 非潜行放置：
 *   - 朝向仅取八个方向（x+、x-、z+、z- 及其 45° 角），由玩家朝向确定；
 *   - 点击方块上表面 → 生成在方块上表面中央；
 *   - 点击方块侧面 → 生成在该侧面紧贴方块的底面中央；
 *   - 点击方块下表面 → 生成在点击方块之下的方块底面中央。
 */
export class ChairManager {
  /**
   * 从物品放置坐垫
   * @param {import("@minecraft/server").PlayerInteractWithBlockBeforeEvent} event
   */
  static placeOnUseEvent(event) {
    // 默认取消方块交互
    event.cancel = true;
    system.run(() => {
      const player = event.player;
      const dimension = player.dimension;
      const handItem = Tool.ItemTool.getPlayerMainHand(player);
      const faceLocation = event.faceLocation;
      if (faceLocation === undefined) {
        return;
      }
      // 精准放置：精准生成在玩家点击的位置，并面向玩家
      if (player.isSneaking) {
        const location = ChairManager.faceLocationToWorld(
          event.block.location,
          event.blockFace,
          faceLocation
        );
        // 面向玩家：把实体朝向对准玩家所在位置
        const facing = ChairManager.getFacingYaw(player, location);
        ChairManager.spawnChairByItem(dimension, location, facing + 180, handItem);
        ChairManager.consumeMainHandItem(player);
        return;
      }

      // 取整放置：按点击面计算放置位置
      let placeLocation = this.getPlaceLocation(event.block.location, event.blockFace);
      if (placeLocation === undefined) {
        return;
      }
      // 点击上/下表面时，取点击位置高度
      if (event.blockFace === Direction.Up || event.blockFace === Direction.Down) {
        const interactLocation = ChairManager.faceLocationToWorld(
          event.block.location,
          event.blockFace,
          faceLocation
        );
        placeLocation.y = interactLocation.y;
      }

      // 八方向朝向（根据玩家朝向 yaw）
      const rot = ChairManager.get8DirectionYaw(player.getRotation().y);
      ChairManager.spawnChairByItem(dimension, placeLocation, rot + 180, handItem);
      ChairManager.consumeMainHandItem(player);
    });
  }

  /**
   * 恢复坐垫模型；优先从放置用物品的 lore 读取，无记录时使用默认包
   * @param  dimension
   * @param {number} location
   * @param {number} rotation
   * @param {import("@minecraft/server").ItemStack} [item] 放置时手持的坐垫物品
   */
  static spawnChairByItem(dimension, location, rotation, item) {
    // 确定模型
    let pack = 1;
    let index = 0;
    if (item !== undefined) {
      const skin = EntityChair.Item.parseSkin(item);
      if (skin !== undefined && ChairSkin.isRegistered(skin.pack, skin.index)) {
        pack = skin.pack;
        index = skin.index;
      }
    }
    // 生成实体，模型编号以生成时事件设置
    // 末影水晶 runtime 无实体角度，initialRotation 无效；朝向写入 thlm:yaw 由客户端动画旋转
    const chair = dimension.spawnEntity(CHAIR_IDENTIFIER, location, {
      spawnEvent: `skin:${index}`
    });
    EntityChair.Skin.setPack(chair, pack);
    EntityChair.Rotation.setYaw(chair, rotation);
  }
  /**
   * 潜行攻击收回坐垫
   * @param {import("@minecraft/server").Entity} player
   * @param {import("@minecraft/server").Entity} chair
   */
  static recycleOnAttackEvent(player, chair) {
    const item = EntityChair.Item.createFromChair(chair);
    const container = player.getComponent("inventory")?.container;
    if (container !== undefined) {
      const leftover = container.addItem(item);
      if (leftover !== undefined) {
        player.dimension.spawnItem(leftover, player.location);
      }
    } else {
      player.dimension.spawnItem(item, player.location);
    }
    chair.triggerEvent("despawn");
  }

  /**
   * 将 faceLocation 转为世界坐标
   *
   * 世界轴向：东=+x，南=+z，上=+y。
   * faceLocation 实际原点/正方向随方块 y 变化（非文档所述西北底角）：
   * - location.y >= 0：东北底角为原点，正方向为西、上、南
   * - location.y < 0：东北顶角为原点，正方向为西、下、南
   * 西/南/顶(或底)面上偶发把远侧坐标报成 0，需按交互面修正为 1。
   *
   * @param {import("@minecraft/server").Vector3} blockLocation 方块坐标
   * @param {import("@minecraft/server").Direction} blockFace 交互面
   * @param {import("@minecraft/server").Vector3} faceLocation 交互坐标
   * @returns {import("@minecraft/server").Vector3}
   */
  static faceLocationToWorld(blockLocation, blockFace, faceLocation) {
    let x = faceLocation.x;
    let y = faceLocation.y;
    let z = faceLocation.z;

    // 西面/南面远侧x/z不可能为0，修正为 1
    if (blockFace === Direction.West && x === 0) x = 1;
    if (blockFace === Direction.South && z === 0) z = 1;

    if (blockLocation.y >= 0) {
      // 东北底角；正方向：西(-x)、上(+y)、南(+z)
      if (blockFace === Direction.Up && y === 0) y = 1;
      return {
        x: blockLocation.x + 1 - x,
        y: blockLocation.y + y,
        z: blockLocation.z + z,
      };
    }

    // 东北顶角；正方向：西(-x)、下(-y)、南(+z)
    if (blockFace === Direction.Down && y === 0) y = 1;
    return {
      x: blockLocation.x + 1 - x,
      y: blockLocation.y + 1 - y,
      z: blockLocation.z + z,
    };
  }

  /**
   * 消耗玩家主手一个物品 todo 主手可能会有快速切物品栏问题，需要验证可靠性
   * @param {import("@minecraft/server").Player} player
   */
  static consumeMainHandItem(player) {
    let item = Tool.ItemTool.getPlayerMainHand(player);
    if (item === undefined) return;
    if (item.amount > 1) {
      item.amount -= 1;
      Tool.ItemTool.setPlayerMainHand(player, item);
    } else {
      Tool.ItemTool.setPlayerMainHand(player);
    }
  }

  /**
   * 获取精准放置的坐垫位置（坐垫只需一格空间）
   * @param {import("@minecraft/server").Vector3} blockLocation 被点击方块位置
   * @param {import("@minecraft/server").Direction} blockFace 点击面
   * @returns {import("@minecraft/server").Vector3 | undefined}
   */
  static getPlaceLocation(blockLocation, blockFace) {
    let location = { x: blockLocation.x, y: blockLocation.y, z: blockLocation.z };
    // 根据点击面计算放置位置：
    //  - 上表面 → 方块上表面中央（y + 1）
    //  - 侧面 → 该侧面紧贴的方块底面中央（向对应方向偏移一格）
    //  - 下表面 → 点击方块之下方块底面中央（y - 1）
    switch (blockFace) {
      case Direction.Up: location.y += 1; break;
      case Direction.Down: location.y -= 1; break;
      case Direction.East: location.x += 1; break;
      case Direction.West: location.x -= 1; break;
      case Direction.South: location.z += 1; break;
      case Direction.North: location.z -= 1; break;
      default: return undefined;
    }
    // 居中到方块中心（y 不加偏移，坐垫底面贴地）
    location.x += 0.5;
    location.z += 0.5;
    return location;
  }

  /**
   * 根据玩家朝向 yaw 映射为八方向 yaw
   *
   * Minecraft yaw：0 = 北(z-)，90 = 东(x+)，180/-180 = 南(z+)，-90 = 西(x-)
   * 每 45° 一个方向，返回符合八方向的 yaw 值。
   * @param {number} yaw 玩家朝向 yaw，范围 [-180, 180]
   * @returns {number} 八方向 yaw
   */
  static get8DirectionYaw(yaw) {
    // 规范化到 [0, 360)
    let normalized = ((yaw % 360) + 360) % 360;
    // 每个八方向区间宽 45°，取区间中心作为落点
    // 0: 北(z-)，45: 东北，90: 东(x+)，135: 东南，180: 南(z+)，225: 西南，270: 西(x-)，315: 西北
    const sectors = [0, 45, 90, 135, 180, 225, 270, 315];
    let idx = Math.round(normalized / 45) % 8;
    let result = sectors[idx];
    // 转为 [-180, 180] 以符合 Minecraft 惯例
    if (result > 180) result -= 360;
    return result;
  }

  /**
   * 获取实体朝向对准目标位置的 yaw
   * 用于潜行放置时让坐垫面向玩家。
   * @param {import("@minecraft/server").Player} player 面向的玩家
   * @param {import("@minecraft/server").Vector3} location 实体位置
   * @returns {number} yaw（朝向玩家）
   */
  static getFacingYaw(player, location) {
    const dx = player.location.x - location.x;
    const dz = player.location.z - location.z;
    // atan2(z, x) 得到的是以 x+ 为 0 的弧度，Minecraft yaw 以 z- 为 0 且顺时针增大
    let yaw = Math.atan2(dx, -dz) * (180 / Math.PI);
    return yaw;
  }
}

