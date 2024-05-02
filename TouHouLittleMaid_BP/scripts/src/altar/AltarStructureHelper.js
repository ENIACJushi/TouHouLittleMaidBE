import { MultiBlockStructrueManager } from "../libs/MultiBlockStructrueManager";
import { system,Block, Dimension, Direction, Entity, ItemStack, Player } from "@minecraft/server";
import { Vector } from "../libs/VectorMC";
import * as Tool from"../libs/ScarletToolKit";
import { altarCraft } from "./AltarCraftHelper";

export class AltarStructureHelper extends MultiBlockStructrueManager{
    constructor(){
        super(
            [8, 6, 8],
            undefined, // [{name:"minecraft:air", data: null}],
            [
                // Left red wool column
                { location: [2, 0, 0], deactivated:{name:"minecraft:red_wool", data:null}, activated:{name: "touhou_little_maid:altar_torii_block"}, data: null},
                { location: [2, 1, 0], deactivated:{name:"minecraft:red_wool", data:null}, activated:{name: "touhou_little_maid:altar_torii_block"}, data: null},
                { location: [2, 2, 0], deactivated:{name:"minecraft:red_wool", data:null}, activated:{name: "touhou_little_maid:altar_torii_block"}, data: null},
                { location: [2, 3, 0], deactivated:{name:"minecraft:red_wool", data:null}, activated:{name: "touhou_little_maid:altar_torii_block"}, data: null},
                { location: [2, 4, 0], deactivated:{name:"minecraft:red_wool", data:null}, activated:{name: "touhou_little_maid:altar_torii_block"}, data: null},
                { location: [2, 5, 0], deactivated:{name:"minecraft:red_wool", data:null}, activated:{name: "touhou_little_maid:altar_torii_block"}, data: null},
                // Right red wool column
                { location: [5, 0, 0], deactivated:{name:"minecraft:red_wool", data:null}, activated:{name: "touhou_little_maid:altar_torii_block"}, data: null},
                { location: [5, 1, 0], deactivated:{name:"minecraft:red_wool", data:null}, activated:{name: "touhou_little_maid:altar_torii_block"}, data: null},
                { location: [5, 2, 0], deactivated:{name:"minecraft:red_wool", data:null}, activated:{name: "touhou_little_maid:altar_torii_block"}, data: null},
                { location: [5, 3, 0], deactivated:{name:"minecraft:red_wool", data:null}, activated:{name: "touhou_little_maid:altar_torii_block"}, data: null},
                { location: [5, 4, 0], deactivated:{name:"minecraft:red_wool", data:null}, activated:{name: "touhou_little_maid:altar_torii_block"}, data: null},
                { location: [5, 5, 0], deactivated:{name:"minecraft:red_wool", data:null}, activated:{name: "touhou_little_maid:altar_torii_block"}, data: null},
                // Down red wool row
                { location: [1, 3, 0], deactivated:{name:"minecraft:red_wool", data:null}, activated:{name: "touhou_little_maid:altar_torii_block"}, data: null},
                { location: [3, 3, 0], deactivated:{name:"minecraft:red_wool", data:null}, activated:{name: "touhou_little_maid:altar_torii_block"}, data: null},
                { location: [4, 3, 0], deactivated:{name:"minecraft:red_wool", data:null}, activated:{name: "touhou_little_maid:altar_torii_block"}, data: null},
                { location: [6, 3, 0], deactivated:{name:"minecraft:red_wool", data:null}, activated:{name: "touhou_little_maid:altar_torii_block"}, data: null},
                // Up red wool row
                { location: [1, 5, 0], deactivated:{name:"minecraft:red_wool", data:null}, activated:{name: "touhou_little_maid:altar_torii_block"}, data: null},
                { location: [3, 5, 0], deactivated:{name:"minecraft:red_wool", data:null}, activated:{name: "touhou_little_maid:altar_torii_block"}, data: null},
                { location: [4, 5, 0], deactivated:{name:"minecraft:red_wool", data:null}, activated:{name: "touhou_little_maid:altar_torii_block"}, data: null},
                { location: [6, 5, 0], deactivated:{name:"minecraft:red_wool", data:null}, activated:{name: "touhou_little_maid:altar_torii_block"}, data: null},
                // Log 1
                { location: [0, 0, 2], deactivated:{name:"minecraft:oak_log", data:{"pillar_axis":"y"}}, activated:{name:"touhou_little_maid:altar_log_block", data:null}},
                { location: [0, 1, 2], deactivated:{name:"minecraft:oak_log", data:{"pillar_axis":"y"}}, activated:{name:"touhou_little_maid:altar_log_block", data:null}},
                { location: [0, 2, 2], deactivated:{name:"minecraft:oak_log", data:{"pillar_axis":"y"}}, activated:{name:"touhou_little_maid:altar_platform_block", data:{"touhou_little_maid:number": 1, "touhou_little_maid:rotation": "r"}}},
                // Log 2
                { location: [0, 0, 5], deactivated:{name:"minecraft:oak_log", data:{"pillar_axis":"y"}}, activated:{name:"touhou_little_maid:altar_log_block", data:null}},
                { location: [0, 1, 5], deactivated:{name:"minecraft:oak_log", data:{"pillar_axis":"y"}}, activated:{name:"touhou_little_maid:altar_log_block", data:null}},
                { location: [0, 2, 5], deactivated:{name:"minecraft:oak_log", data:{"pillar_axis":"y"}}, activated:{name:"touhou_little_maid:altar_platform_block", data:{"touhou_little_maid:number": 2, "touhou_little_maid:rotation": "r"}}},
                // Log 3
                { location: [2, 0, 7], deactivated:{name:"minecraft:oak_log", data:{"pillar_axis":"y"}}, activated:{name:"touhou_little_maid:altar_log_block", data:null}},
                { location: [2, 1, 7], deactivated:{name:"minecraft:oak_log", data:{"pillar_axis":"y"}}, activated:{name:"touhou_little_maid:altar_log_block", data:null}},
                { location: [2, 2, 7], deactivated:{name:"minecraft:oak_log", data:{"pillar_axis":"y"}}, activated:{name:"touhou_little_maid:altar_platform_block", data:{"touhou_little_maid:number": 3, "touhou_little_maid:rotation": "r"}}},
                // Log 4
                { location: [5, 0, 7], deactivated:{name:"minecraft:oak_log", data:{"pillar_axis":"y"}}, activated:{name:"touhou_little_maid:altar_log_block", data:null}},
                { location: [5, 1, 7], deactivated:{name:"minecraft:oak_log", data:{"pillar_axis":"y"}}, activated:{name:"touhou_little_maid:altar_log_block", data:null}},
                { location: [5, 2, 7], deactivated:{name:"minecraft:oak_log", data:{"pillar_axis":"y"}}, activated:{name:"touhou_little_maid:altar_platform_block", data:{"touhou_little_maid:number": 4, "touhou_little_maid:rotation": "r"}}},
                // Log 5
                { location: [7, 0, 2], deactivated:{name:"minecraft:oak_log", data:{"pillar_axis":"y"}}, activated:{name:"touhou_little_maid:altar_log_block", data:null}},
                { location: [7, 1, 2], deactivated:{name:"minecraft:oak_log", data:{"pillar_axis":"y"}}, activated:{name:"touhou_little_maid:altar_log_block", data:null}},
                { location: [7, 2, 2], deactivated:{name:"minecraft:oak_log", data:{"pillar_axis":"y"}}, activated:{name:"touhou_little_maid:altar_platform_block", data:{"touhou_little_maid:number": 5, "touhou_little_maid:rotation": "r"}}},
                // Log 6
                { location: [7, 0, 5], deactivated:{name:"minecraft:oak_log", data:{"pillar_axis":"y"}}, activated:{name:"touhou_little_maid:altar_log_block", data:null}},
                { location: [7, 1, 5], deactivated:{name:"minecraft:oak_log", data:{"pillar_axis":"y"}}, activated:{name:"touhou_little_maid:altar_log_block", data:null}},
                { location: [7, 2, 5], deactivated:{name:"minecraft:oak_log", data:{"pillar_axis":"y"}}, activated:{name:"touhou_little_maid:altar_platform_block", data:{"touhou_little_maid:number": 6, "touhou_little_maid:rotation": "r"}}}
            ]
        );
        this.entities = [
            {location:[2, 4, 0], name:"touhou_little_maid:altar_main"}
            // {location:[0, 2, 2], name:"touhou_little_maid:altar_item"},
            // {location:[0, 2, 5], name:"touhou_little_maid:altar_item"},
            // {location:[2, 2, 7], name:"touhou_little_maid:altar_item"},
            // {location:[5, 2, 7], name:"touhou_little_maid:altar_item"},
            // {location:[7, 2, 2], name:"touhou_little_maid:altar_item"},
            // {location:[7, 2, 5], name:"touhou_little_maid:altar_item"}
        ];
        this.platforms = [[0, 2, 2], [0, 2, 5], [2, 2, 7], [5, 2, 7], [7, 2, 2], [7, 2, 5]]
    }
    /**
     * Generate blocks and entities
     * @param {Dimension} dimension 
     * @param {Vector} blockLocation
     * @param {Direction} blockFace 
     */
    activate(dimension, blockLocation, blockFace){
        // Get rotation
        let rotation = null;
        let rotationString = null;
        switch(blockFace){
            case Direction.North: rotation = 0; rotationString = "north"; break;
            case Direction.East : rotation = 1; rotationString = "east" ; break;
            case Direction.South: rotation = 2; rotationString = "south"; break;
            case Direction.West : rotation = 3; rotationString = "west" ; break;
            default: return false;
        }

        // Get baseLocation
        let blockLocation_json = [blockLocation.x, blockLocation.y, blockLocation.z];
        let baseLocation = super.getBaseLocationByPoint([3, 3, 0], blockLocation_json, rotation);
        // Set structure
        // Try 1: First direction
        if(super.activate(dimension, baseLocation, [rotation]) == -1){
            baseLocation = super.getBaseLocationByPoint([4, 3, 0], blockLocation_json, rotation);
            // Try 2: Second direction
            if(super.activate(dimension, baseLocation, [rotation]) == -1){
                baseLocation = null;
            }
        }
        // Activate the main entity (When structure was set)
        if(baseLocation != null){
            // Main entity
            for(let entity of this.entities){
                let location = super.rotateCoordinate(entity.location, rotation);
                let x = Math.ceil(baseLocation[0] + location[0]) + 0.5;
                let y = Math.ceil(baseLocation[1] + location[1]);
                let z = Math.ceil(baseLocation[2] + location[2]) + 0.5;
                dimension.spawnEntity(entity.name, { x: x, y: y, z: z }).triggerEvent(rotationString)
            }
        }
    }
    deactivateEvent(entity){
        let rotation = entity.getComponent("minecraft:variant").value;
        let baseLocation = super.getBaseLocationByPoint([2, 4, 0], [Math.floor(entity.location.x), Math.floor(entity.location.y), Math.floor(entity.location.z)], rotation);

        if(super.deactivate(entity.dimension, baseLocation, rotation)){
            // Despawn main entity
            entity.dimension.runCommand(`event entity @e[x=${baseLocation[0]},y=${baseLocation[1]},z=${baseLocation[2]},dx=8,dy=6,dz=8,type=touhou_little_maid:altar_main] despawn`);
            
            // Pop items
            for(let platform of this.platforms){
                let platformLocation = super.getPointByBaseLocation(platform, baseLocation, rotation);
                let itemEntity = this.searchAltarItemEntity(entity.dimension, { x: platformLocation[0], y: platformLocation[1] + 1, z: platformLocation[2] });
                if(itemEntity != null) {
                    this.popItem(itemEntity);
                }
            }
        }
    }
    /**
     * 
     * @param {Vector} blockLocation 
     * @param {Player} player 
     * @param {ItemStack} item 
     */
    placeItemEvent(blockLocation, player){
        let dimension = player.dimension;
        // Search for item entity.
        let itemEntity = this.searchAltarItemEntity(dimension, {x: blockLocation.x, y: blockLocation.y + 1, z: blockLocation.z});

        // Place item then trigger craft event, pop item, or do nothing.
        let container = player.getComponent("inventory").container;
        let slot = player.selectedSlot;
        let itemStack = container.getItem(slot);
        // There are no items on the platform.
        if(itemEntity == null){
            // There are some items on player main hand.
            if(itemStack && itemStack.typeId != ""){
                if(itemStack.amount == 1){
                    // Place item on the platform.
                    let temp = player.dimension.spawnItem(itemStack.clone(), {x: blockLocation.x + 0.5, y: blockLocation.y + 1, z: blockLocation.z + 0.5});
                    temp.clearVelocity();
                    temp.addTag("touhou_little_maid:altar_item");
                    
                    // Clear main hand
                    container.setItem(slot);
                    system.runTimeout(() =>{ this.craftEvent(blockLocation, player); }, 1);
                }
                else{
                    // Place item on the platform.
                    let platform_itemStack = itemStack.clone();
                    platform_itemStack.amount = 1;
                    let temp = player.dimension.spawnItem(platform_itemStack, {x: blockLocation.x + 0.5, y: blockLocation.y + 1, z: blockLocation.z + 0.5});
                    temp.clearVelocity();
                    temp.addTag("touhou_little_maid:altar_item");

                    // amount--
                    itemStack.amount --;
                    container.setItem(slot, itemStack);
                    system.runTimeout(() =>{ this.craftEvent(blockLocation, player); }, 1);
                }
            }
        }
        // There are some items on the platform
        else{
            // There are no items on player main hand, pop item on platform.
            // TODO: 新版本中手上没有物品则不会触发这个事件，要另寻它法
            if(!itemStack || itemStack.typeId == ""){
                this.popItem(itemEntity);
            }
        }
    }
    /**
     * 
     * @param {Vector} blockLocation 
     * @param {Player} player 
     */
    craftEvent(blockLocation, player){
        let block = player.dimension.getBlock(blockLocation);
        let number = block.permutation.getState("touhou_little_maid:number") - 1;
        let rotation = block.permutation.getState("touhou_little_maid:rotation") - 1;
        let baseLocation = super.getBaseLocationByPoint(this.platforms[number], [blockLocation.x, blockLocation.y, blockLocation.z], rotation);
        let itemEntityArray = [];
        let itemStackArray = [];
        for(let platform of this.platforms){
            let platformLocation = super.getPointByBaseLocation(platform, baseLocation, rotation);
            let itemEntity = this.searchAltarItemEntity(player.dimension, {x: platformLocation[0], y: platformLocation[1] + 1, z: platformLocation[2]});
            if(itemEntity != null) {
                let itemStack = itemEntity.getComponent("minecraft:item").itemStack;
                if(itemStack.amount == 1){
                    itemEntityArray.push(itemEntity);
                    itemStackArray.push(itemStack);
                }
                else{
                    // If amount lager than 1, pop this item
                    this.popItem(itemEntity);
                }
            }
        }
        let outputLocation = super.getPointByBaseLocation([3.5, 0, 3.5], baseLocation, rotation);
        
        if(altarCraft.matchRecipes(player, itemStackArray, player.dimension, {x: outputLocation[0], y: outputLocation[1], z: outputLocation[2]})){
            for(let itemEntity of itemEntityArray){
                itemEntity.kill();
                player.dimension.runCommand(`playsound altar_craft ${Tool.playerCMDName(player.name)}`);
            }
        }
    }
    /**
     * 
     * @param {Dimension} dimension 
     * @param {Vector3} blockLocation 
     */
    searchAltarItemEntity(dimension, blockLocation){
        for(let entity of dimension.getEntitiesAtBlockLocation(blockLocation)){
            if(entity.typeId == "minecraft:item"){
                if(entity.hasTag("touhou_little_maid:altar_item")){
                    return entity;
                }
            }
        }
        return null;
    }
    /**
     * 
     * @param {Entity} itemEntity 
     */
    popItem(itemEntity){
        itemEntity.removeTag("touhou_little_maid:altar_item");
        let drectionX = Tool.getRandom() < 0.5 ? 1 : -1;
        let drectionZ = Tool.getRandom() < 0.5 ? 1 : -1;
        itemEntity.applyImpulse(new Vector(drectionX * Tool.getRandom(0.1, 0.2),
                                                      Tool.getRandom(0.3, 0.4),
                                          drectionZ * Tool.getRandom(0.1, 0.2)));
    }
    /**
     * 
     * @param {Entity} entity 
     */
    refreshItemsEvent(entity){
        let rotation = entity.getComponent("minecraft:variant").value;
        let baseLocation = super.getBaseLocationByPoint([2, 4, 0], [Math.floor(entity.location.x), Math.floor(entity.location.y), Math.floor(entity.location.z)], rotation);
        
        for(let platform of this.platforms){
            let platformLocation = super.getPointByBaseLocation(platform, baseLocation, rotation);
            let itemLocation = {x: platformLocation[0] + 0.5, y: platformLocation[1] + 1, z: platformLocation[2] + 0.5};
            let itemEntity = this.searchAltarItemEntity(entity.dimension, itemLocation);
            if(itemEntity != null) {
                let item = itemEntity.getComponent("minecraft:item").itemStack;
                let temp = entity.dimension.spawnItem(item, itemLocation);
                temp.addTag("touhou_little_maid:altar_item");
                temp.clearVelocity();
                itemEntity.kill();
            }
        }
    }
}

export const altarStructure = new AltarStructureHelper();