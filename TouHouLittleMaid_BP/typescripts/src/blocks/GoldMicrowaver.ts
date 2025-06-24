import {
  Direction,
  Block,
  BlockPermutation,
  PlayerInteractWithBlockBeforeEvent,
  DataDrivenEntityTriggerAfterEvent,
  Entity,
  ItemStack,
  Player,
  BlockVolume,
  StartupEvent,
  system,
} from "@minecraft/server";
import { VO } from "../libs/VectorMC";
import { BlockTool, ItemTool } from "../libs/ScarletToolKit";

export class GoldMicrowaver {
  /**
   * 获取方块对应的实体
   */
  static getBlockEntity(block: Block) {
    let entity = block.dimension.getEntities({
      "type": "touhou_little_maid:gold_microwaver",
      "closest": 1,
      "maxDistance": 0.5,
      "location": { x: block.location.x + 0.5, y: block.location.y, z: block.location.z + 0.5 }
    });
    return entity[0];
  }
  /**
   * 注册方块属性
   */
  static registerCC(event: StartupEvent) {
    event.blockComponentRegistry.registerCustomComponent("tlm:microwaver", {
      beforeOnPlayerPlace(e) {
        system.run(() => {

          if (!e.permutationToPlace.getState("thlm:first_place")) {
            return;
          }

          // 设置方块状态
          e.permutationToPlace = e.permutationToPlace
            .withState("thlm:door", false)
            .withState("thlm:item", 0)
            .withState("thlm:status", false)
            .withState("thlm:first_place", false);

          // 生成方块实体
          let rot = 0;
          switch (e.permutationToPlace.getState("minecraft:cardinal_direction")) {
            case "north": rot = 0; break;
            case "south": rot = 180; break;
            case "east": rot = 90; break;
            case "west": rot = -90; break;
            default: return;
          }
          e.dimension.spawnEntity('touhou_little_maid:gold_microwaver' as any,
            e.block.bottomCenter(), { initialRotation: rot });
        })
      },
      onPlayerBreak(e) {
        system.run(() => {
          let entity = GoldMicrowaver.getBlockEntity(e.block);
          entity.triggerEvent("thlmw:d");
        })
      },
      onPlayerInteract(e) {
        const player = e.player;
        if (!player) {
          return;
        }

        let itemStack = ItemTool.getPlayerMainHand(player);
        if (itemStack === undefined) {
          let entity = GoldMicrowaver.getBlockEntity(e.block);
          if (entity === undefined) return;
          if (player.isSneaking) entity.triggerEvent("thlmw:s");
          else entity.triggerEvent("thlmw:i")
        }
        else {
          GoldMicrowaver.interactEvent(e.block, e.player);
        }
      }
    })
  }
  // 配方列表
  static recipes = [
    undefined, // 空气占位
    // {"material": "minecraft:apple"                , "result": "minecraft:bone"                 , "max":1, "time": 10 }, // 测试用
    { "material": "touhou_little_maid:dragon_skull", "result": "touhou_little_maid:magic_powder", "max": 1, "time": 180 },

    { "material": "minecraft:chicken", "result": "minecraft:cooked_chicken", "max": 128, "time": 128 },
    { "material": "minecraft:porkchop", "result": "minecraft:cooked_porkchop", "max": 128, "time": 128 },
    { "material": "minecraft:beef", "result": "minecraft:cooked_beef", "max": 128, "time": 128 },
    { "material": "minecraft:mutton", "result": "minecraft:cooked_mutton", "max": 128, "time": 128 },
    { "material": "minecraft:rabbit", "result": "minecraft:cooked_rabbit", "max": 128, "time": 128 },
    { "material": "minecraft:cod", "result": "minecraft:cooked_cod", "max": 128, "time": 128 },
    { "material": "minecraft:salmon", "result": "minecraft:cooked_salmon", "max": 128, "time": 128 },

    { "material": "minecraft:potato", "result": "minecraft:baked_potato", "max": 128, "time": 128 },
    { "material": "minecraft:kelp", "result": "minecraft:dried_kelp", "max": 128, "time": 128 },
    { "material": "minecraft:chorus_fruit", "result": "minecraft:popped_chorus_fruit", "max": 128, "time": 128 }

  ]

  /**
   * 由材料获取配方
   * @param {string} name
   * @returns {number}
   */
  static getRecipeIndexByMaterial(name: string): number {
    if (name === undefined) {
      return 0;
    }
    for (let i = 1; i < this.recipes.length; i++) {
      if (this.recipes[i]?.material === name) {
        return i;
      }
    }
    return 0;
  }

  /**
   * 由方块获得实体
   * @param {Block} block
   * @returns {Entity|undefined} 
   */
  static getEntityByBlock(block: Block): Entity | undefined {
    let entityLocation = block.location;
    entityLocation.x += 0.5;
    entityLocation.z += 0.5;
    const results = block.dimension.getEntities({
      type: 'touhou_little_maid:gold_microwaver',
      maxDistance: 0.5,
      location: entityLocation
    });
    if (results.length === 0) return undefined;
    return results[0];
  }
  /**
   * 由实体获得方块
   * @param {Entity} waver
   * @returns {Block|undefined} 
   */
  static getBlockByEntity(waver: Entity): Block | undefined {
    return waver.dimension.getBlock(waver.location);
  }

  // 实体方法
  static Entity = {
    /**
     * 获取物品 index
     * @param {Entity} entity
     * @returns {number}
     */
    getItem(entity: Entity): number {
      return entity.getProperty("thlm:item") as number;
    },

    /**
     * 设置物品
     *   若门没有开则不设置并返回 false
     *   若已有物品则会被弹出，设置成功回返回 true
     */
    setItem(entity: Entity, index: number): boolean {
      // 门没开
      if (!this.getDoor(entity)) return false;

      // 检测已有物品
      let oldIndex = this.getItem(entity);
      if (oldIndex !== 0) {
        // 弹出已有物品(若未完成微波)
        if (this.getProgress(entity) < 1) {
          this.spawnItem(entity, GoldMicrowaver.recipes[oldIndex]!.material, this.getAmount(entity));
        }
      }

      // 设置当前物品
      entity.setProperty("thlm:item", index);

      // 设置进度
      entity.setProperty("thlm:time", 0);
      entity.setProperty("thlm:progress", 0);
      let recipe = GoldMicrowaver.recipes[index]
      entity.setProperty("thlm:total_time", recipe === undefined ? 0 : recipe.time);

      return true;
    },

    /**
     * 获取物品数量
     */
    getAmount(entity: Entity): number {
      return entity.getProperty("thlm:amount") as number;
    },

    /**
     * 设置物品数量
     * @param {Entity} entity 
     * @param {number} amount
     */
    setAmount(entity: Entity, amount: number) {
      entity.setProperty("thlm:amount", amount);
    },

    /**
     * 获取门状态
     * @param {Entity} entity 
     * @returns {boolean}
     */
    getDoor(entity: Entity): boolean {
      return entity.getComponent("minecraft:is_baby") !== undefined;
    },

    /**
     * 设置门状态
     * @param {Entity} entity
     * @param {boolean} status
     */
    setDoor(entity: Entity, status: boolean) {
      entity.triggerEvent(status ? "door_open" : "door_close");
    },

    /**
     * 设置工作状态
     * @param {Entity} entity
     * @param {Boolean} status
     */
    setStatus(entity: Entity, status: boolean) {
      entity.triggerEvent(status ? "activate" : "deactivate")
    },
    
    /**
     * 获取工作状态
     */
    getStatus(entity: Entity): boolean {
      return entity.getProperty("thlm:status") as boolean;
    },

    /**
     * 获取进度
     */
    getProgress(entity: Entity): number {
      return entity.getProperty("thlm:progress") as number;
    },
    /**
     * 设置进度
     */
    setProgress(entity: Entity, progress: number) {
      entity.setProperty("thlm:progress", progress);
    },

    /**
     * 生成物品
     * @param itemDefinition 物品定义，当前仅支持字符
     */
    spawnItem(entity: Entity, itemDefinition: string, amount: number = 1) {
      let left = amount;
      while (true) {
        if (left <= 64) {
          entity.dimension.spawnItem(new ItemStack(itemDefinition, left), entity.location);
          return;
        }
        entity.dimension.spawnItem(new ItemStack(itemDefinition, 64), entity.location);
        left -= 64;
      }
    }
  }

  // 方块方法
  static Block = {
    /**
     * 设置工作状态
     */
    setStatus(block: Block, status: boolean) {
      block.setPermutation(block.permutation.withState("thlm:status", status));
    },
    /**
     * 设置门状态
     */
    setDoor(block: Block, status: boolean) {
      block.setPermutation(block.permutation.withState("thlm:door", status));
    }
  }

  /**
   * 放置事件 弃用
   * @param {PlayerInteractWithBlockBeforeEvent} event 
   */
  static placeEvent(event: PlayerInteractWithBlockBeforeEvent) {
    if (!event.itemStack) {
      return;
    }
    // 决定位置  PS: faceLocation 是交互面上被点的坐标
    let location = event.block.location;
    switch (event.blockFace) {
      case Direction.Down: location.y--; break;
      case Direction.Up: location.y++; break;
      case Direction.East: location.x++; break;
      case Direction.West: location.x--; break;
      case Direction.South: location.z++; break;
      case Direction.North: location.z--; break;
      default: return;
    }

    // 可放置判断
    let player = event.player;
    let dimension = player.dimension;
    const block = dimension.getBlock(location);
    if (!block?.isAir) {
      return;
    }

    // 决定方向 xz
    let view = player.getViewDirection();
    let direction = VO.Advanced.getDirectionByView2D(view);
    let directionNum = 0;
    switch (direction) {
      case Direction.North: directionNum = 1; break;
      case Direction.East: directionNum = 2; break;
      case Direction.South: directionNum = 3; break;
      case Direction.West: directionNum = 4; break;
      default: return;
    }

    // 放置方块
    dimension.fillBlocks(new BlockVolume(location, location),
      BlockPermutation.resolve("touhou_little_maid:gold_microwaver",
        { "thlm:direction": directionNum, "thlm:door": false, "thlm:item": 0, "thlm:status": false }));

    // 放置实体
    location.x += 0.5;
    location.z += 0.5;
    let entity = dimension.spawnEntity("touhou_little_maid:gold_microwaver" as any, location);
    entity.triggerEvent(direction);

    // 消耗物品
    let container = player.getComponent("inventory")?.container;
    if (!container) {
      return;
    }

    let slot = player.selectedSlotIndex;
    if (event.itemStack.amount === 1) {
      container.setItem(slot);
    } else {
      let itemStack = container.getItem(slot);
      if (itemStack) {
        itemStack.amount--;
        container.setItem(slot, itemStack);
      }
    }
    // 取消交互 避免物品再次被其它事件使用
    event.cancel = true;
  }

  /**
   * 交互事件
   */
  static interactEvent(waverBlock: Block, player: Player) {
    let waver = this.getEntityByBlock(waverBlock);
    if (waver === undefined) {
      return;
    }
    this.interactBaseEvent(waver, waverBlock, player);
  }

  /** 
   * 交互事件 空手
   * @param {DataDrivenEntityTriggerAfterEvent} event 
  */
  static interactEventNoItem(event: DataDrivenEntityTriggerAfterEvent) {
    let waver = event.entity;
    let waverBlock = this.getBlockByEntity(waver);
    if (!waverBlock) {
      return;
    }
    this.interactBaseEvent(waver, waverBlock, undefined, false);
  }

  /** 
   * 交互事件 空手潜行
   * @param {DataDrivenEntityTriggerAfterEvent} event 
  */
  static interactEventNoItemSneaking(event: DataDrivenEntityTriggerAfterEvent) {
    let waver = event.entity;
    let waverBlock = this.getBlockByEntity(waver);
    if (!waverBlock) {
      return;
    }
    this.interactBaseEvent(waver, waverBlock, undefined, true);
  }

  /**
   * 交互基础事件
   * @param waver 
   * @param waverBlock 
   * @param player 为空时代表空手交互
   * @param sneaking_ player 为空时使用，表示是否潜行
   */
  static interactBaseEvent(waver: Entity, waverBlock: Block, player: Player | undefined, sneaking_:boolean = false) {
    let sneaking = player === undefined ? sneaking_ : player.isSneaking
    
    // 工作中 | State 10n 0.x
    if (this.Entity.getStatus(waver)) {
      // 暂停工作
      this.Entity.setStatus(waver, false);
      this.Block.setStatus(waverBlock, false);
      // 潜行时直接开门  不潜行只是暂停
      if (sneaking) {
        this.Entity.setDoor(waver, true);
        this.Block.setDoor(waverBlock, true);
      }
      return;
    }

    // 空闲状态/工作暂停
    // 开门状态
    if (this.Entity.getDoor(waver)) {
      let recipeIndex = this.Entity.getItem(waver);
      // 有物品
      if (recipeIndex !== 0) {
        let progress = this.Entity.getProgress(waver);
        // State 01n 0 | 开门有物品
        if (progress <= 0) {
          if (sneaking) {
            // 潜行 取出物品
            this.Entity.setItem(waver, 0);
            this.Entity.setAmount(waver, 0);
          }
          else {
            let success = false;
            if (player !== undefined) {
              // 非潜行，先尝试叠加物品
              let item = ItemTool.getPlayerMainHand(player) as ItemStack;
              let inputIndex = this.getRecipeIndexByMaterial(item.typeId);
              if (recipeIndex === inputIndex) {
                let currentAmount = this.Entity.getAmount(waver);
                let recipe = this.recipes[recipeIndex]!;
                if (currentAmount < recipe["max"]) {
                  success = true;
                  let inputAmount = Math.min(recipe["max"] - currentAmount, item.amount);
                  // 消耗物品
                  ItemTool.setPlayerMainHand(player, item.amount - inputAmount === 0 ? undefined : (item.amount -= inputAmount, item));
                  // 设置数量
                  this.Entity.setAmount(waver, currentAmount + inputAmount);
                }
              }
            }

            // 空手或叠加失败，关门
            if (!success) {
              this.Entity.setDoor(waver, false);
              this.Block.setDoor(waverBlock, false);
              this.Entity.setStatus(waver, true);
              this.Block.setStatus(waverBlock, true);
            }
          }
        }
        // State 01n 1 | 工作完成 - 开门
        else if (progress >= 1) {
          this.Entity.spawnItem(waver, this.recipes[recipeIndex]!.result, this.Entity.getAmount(waver));
          this.Entity.setItem(waver, 0);
          this.Entity.setAmount(waver, 0);
        }
        // State 01n 0.x | 工作暂停 - 开门
        else {
          if (sneaking) {
            // 返还材料并恢复状态
            this.Entity.setItem(waver, 0);
            this.Entity.setAmount(waver, 0);
          }
          else {
            // 继续工作
            this.Entity.setStatus(waver, true);
            this.Block.setStatus(waverBlock, true);
            this.Entity.setDoor(waver, false);
            this.Block.setDoor(waverBlock, false);
          }
        }
      }
      // State 010 0 | 开门无物品
      else {
        // 空手或潜行  关门
        if (sneaking || player === undefined) {
          this.Entity.setDoor(waver, false);
          this.Block.setDoor(waverBlock, false);
          return;
        }

        // 空手或潜行  关门
        let item = ItemTool.getPlayerMainHand(player);
        if (!item) {
          this.Entity.setDoor(waver, false);
          this.Block.setDoor(waverBlock, false);
          return;
        }

        // 非潜行，先尝试放入物品
        let recipeIndex = this.getRecipeIndexByMaterial(item.typeId);
        if (recipeIndex !== 0) {
          // 设置物品
          this.Entity.setItem(waver, recipeIndex);
          // 消耗物品
          let recipe = this.recipes[recipeIndex];
          let inputAmount = Math.min(item.amount, recipe!.max)
          ItemTool.setPlayerMainHand(player, item.amount - inputAmount === 0 ? undefined : (item.amount -= inputAmount, item));
          // 设置数量
          this.Entity.setAmount(waver, inputAmount);
        }
        // 放入失败  关门
        else {
          this.Entity.setDoor(waver, false);
          this.Block.setDoor(waverBlock, false);
        }
      }
      return;
    }
    // 关门状态
    let recipeIndex = this.Entity.getItem(waver);
    // State 000 0 | 关门无物品
    if (recipeIndex === 0) {
      this.Entity.setDoor(waver, true);
      this.Block.setDoor(waverBlock, true);
      return;
    }
    // State 00n 1 | 工作完成 - 关门
    if (this.Entity.getProgress(waver) >= 1) {
      this.Entity.setDoor(waver, true);
      this.Block.setDoor(waverBlock, true);
      return;
    }
    // State 00n 0.x | 工作暂停 - 关门
    // 潜行状态
    if (sneaking) {
      this.Entity.setDoor(waver, true);
      this.Block.setDoor(waverBlock, true);
      return;
    }
    // 非潜行状态
    this.Entity.setStatus(waver, true);
    this.Block.setStatus(waverBlock, true);
  }

  /** 
   * 销毁事件
   * @param {DataDrivenEntityTriggerAfterEvent} event 
  */
  static despawnEvent(event: DataDrivenEntityTriggerAfterEvent) {
    let microwaver = event.entity;
    // 掉落物品
    microwaver.triggerEvent("despawn");
    let recipes = this.recipes[this.Entity.getItem(microwaver)]
    if (recipes !== undefined) {
      if (this.Entity.getProgress(microwaver) >= 1.0) {
        this.Entity.spawnItem(microwaver, recipes.result, this.Entity.getAmount(microwaver));
      }
      else {
        this.Entity.spawnItem(microwaver, recipes.material, this.Entity.getAmount(microwaver));
      }
    }
  }
  /** 
   * 完成事件 用于设置方块的 status
   * @param {DataDrivenEntityTriggerAfterEvent} event 
  */
  static finishEvent(event: DataDrivenEntityTriggerAfterEvent) {
    let waver = event.entity;

    let waverBlock = this.getBlockByEntity(waver);
    if (waverBlock === undefined) return;
    this.Block.setStatus(waverBlock, false);
  }
}