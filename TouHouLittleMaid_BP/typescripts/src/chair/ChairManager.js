import {Direction, system} from "@minecraft/server";
import {CHAIR_IDENTIFIER, EntityChair} from "./EntityChair";
import * as Tool from "../libs/ScarletToolKit";
import {ChairSkin} from "./skin/ChairSkin";

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
      const expected = event.itemStack;
      // 物品已丢出或切换：中止，避免复制
      if (!Tool.ItemTool.isMainHandStillItem(player, expected)) {
        return;
      }
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
        Tool.ItemTool.consumeMainHandIfMatch(player, expected);
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
      Tool.ItemTool.consumeMainHandIfMatch(player, expected);
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
    // 生成实体，模型编号以生成时事件设置；朝向用实体自身 yaw
    const chair = dimension.spawnEntity(CHAIR_IDENTIFIER, location, {
      initialRotation: rotation,
      spawnEvent: `skin:${index}`
    });
    EntityChair.Skin.setPack(chair, pack);
    // spawnEvent 已设 variant；延后一 tick 再应用 mounted_height，确保实体事件就绪
    system.run(() => {
      if (!chair.isValid) {
        return;
      }
      EntityChair.Skin.applyMountedHeight(chair);
    });
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
   * faceLocation 并非固定「西北底角」：各方块轴上，原点落在靠近世界 0 的那一侧，
   * face 正方向指向远离 0 的一侧（与 y 轴既有经验一致，x/z 按象限同理）：
   * - 轴坐标 >= 0：原点在该轴较小面（西/底/北），world = block + face
   * - 轴坐标 < 0：原点在该轴较大面（东/顶/南），world = block + 1 - face
   * 远侧面上偶发把坐标报成 0，需按当前原点所在轴修正为 1。
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

    // 各方块轴：原点是否在靠近世界 0 的较小面
    const xFromMin = blockLocation.x >= 0;
    const yFromMin = blockLocation.y >= 0;
    const zFromMin = blockLocation.z >= 0;

    // 远侧偶发报 0 → 修正为 1（远侧 = 远离世界 0 的面）
    if (xFromMin) {
      if (blockFace === Direction.East && x === 0) x = 1;
    } else if (blockFace === Direction.West && x === 0) {
      x = 1;
    }
    if (yFromMin) {
      if (blockFace === Direction.Up && y === 0) y = 1;
    } else if (blockFace === Direction.Down && y === 0) {
      y = 1;
    }
    if (zFromMin) {
      if (blockFace === Direction.South && z === 0) z = 1;
    } else if (blockFace === Direction.North && z === 0) {
      z = 1;
    }

    return {
      x: xFromMin ? blockLocation.x + x : blockLocation.x + 1 - x,
      y: yFromMin ? blockLocation.y + y : blockLocation.y + 1 - y,
      z: zFromMin ? blockLocation.z + z : blockLocation.z + 1 - z,
    };
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

