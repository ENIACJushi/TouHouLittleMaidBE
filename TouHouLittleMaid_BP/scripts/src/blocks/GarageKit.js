import { ItemUseOnBeforeEvent, EquipmentSlot, Block, Direction, system, Dimension, Entity, ItemStack, DataDrivenEntityTriggerAfterEvent, BlockPermutation, Player, BlockVolume, BlockVolumeBase, WorldInitializeBeforeEvent } from "@minecraft/server";
import { Vector } from "../libs/VectorMC";
import { StrMaid } from "../maid/StrMaid";
import { ActionbarMessage, getRandomInteger, ItemTool, logger, lore2Str, str2Lore, title_player_actionbar_object, title_player_actionbar_translate } from "../libs/ScarletToolKit";
import { EntityMaid } from "../maid/EntityMaid";
import { isBadContainerBlock } from "../../data/BadContainerBlocks";
import { MaidSkin } from "../maid/MaidSkin";
import { Watch } from "../libs/SecondWatch"

const blockGarageKit = "touhou_little_maid:garage_kit_block";
const blockStatues = "touhou_little_maid:statues_block";

export class GarageKit{
    /**
     * 获取方块对应的实体
     * @param {Block} block 
     * @param {Boolean} solid 
     * @returns 
     */
    static getBlockEntity(block, solid=false){
        let entity = block.dimension.getEntities({
            // "type": "thlmm:maid",
            "families": [(solid ? "thlm:garage_kit_solid" : "thlm:garage_kit_un_solid")],
            "closest": true,
            "maxDistance": 0.5,
            "location": {x: block.location.x+0.5, y: block.location.y, z: block.location.z+0.5}
        });
        return entity[0];
    }
    /**
     * @param {WorldInitializeBeforeEvent} event 
     */
    static registerCC(event){
        event.blockComponentRegistry.registerCustomComponent("tlm:garage_kit", {
            onPlayerDestroy(e){
                let entity = GarageKit.getBlockEntity(e.block, true);
                if(entity === undefined) return;
                entity.triggerEvent("thlmm:u");
            }
        });
        event.blockComponentRegistry.registerCustomComponent("tlm:garage_kit_un_solid", {
            onPlayerDestroy(e){
                let entity = GarageKit.getBlockEntity(e.block, false);
                if(entity === undefined) return;
                entity.triggerEvent("thlmm:u");
            }
        })
    }
    /**
     * 尺寸 从大到小排列，第一个可以烧成手办，大小不可更改
     */
    static SIZE = [
        { scale: 0.5, space: [1, 1, 1]},
        { scale: 1.0, space: [1, 2, 1]},
        { scale: 2.0, space: [2, 4, 2]},
        { scale: 3.0, space: [3, 6, 3]}
    ]
    /**
     * 刻刀使用事件（激活手办）
     * 1x1x1（0.5），1x1x2（1），2x2x4（2），3x3x6（3）
     * @param {ItemUseOnBeforeEvent} event 
     */
    static activate(event){
        let player = event.source;
        let block = event.block;
        // 必须对黏土使用
        if(!isClay(block)){
            ActionbarMessage.translate(player, "message.touhou_little_maid:chisel.hit_block_error.name"); // 请右击粘土块
            return;
        }

        // 检测副手物品
        let equippable = player.getComponent("minecraft:equippable");
        let offhand = equippable.getEquipment(EquipmentSlot.Offhand);
        if(offhand === undefined){
            ActionbarMessage.translate(player, "message.touhou_little_maid:chisel.offhand_not_photo.name"); // 请副手持有一张女仆照片
            return;
        }
        let skin;
        switch(offhand.typeId){
            case "touhou_little_maid:photo":
                // 获取女仆编号
                let lore = offhand.getLore();
                if(lore === undefined){
                    ActionbarMessage.translate(player, "message.touhou_little_maid:photo.have_no_nbt_data.name"); // 这该死的照片没有 NBT 数据
                    return;
                }
                skin = StrMaid.Skin.get(lore2Str(lore))
                break;
            default:
                ActionbarMessage.translate(player, "message.touhou_little_maid:chisel.offhand_not_photo.name"); // 请副手持有一张女仆照片
                return;
        }

        // 匹配和生成黏土结构 从左下角开始
        let blockFace = event.blockFace;
        let dimension = event.block.dimension;

        let xSign = 1;
        let zSign = 1;
        let facing = [1, 0]; // 面朝 x, z
        switch(blockFace){
            case Direction.East: 
                xSign = -1;
                zSign = -1;
                facing = [1, 0];
                break;
            case Direction.South: 
                xSign = 1;
                zSign = -1;
                facing = [0, 1];
                break;
            case Direction.West:
                xSign = 1;
                zSign = 1;
                facing = [-1, 0];
                break;
            default:
            case Direction.Up: 
            case Direction.Down:
            case Direction.North:
                xSign = -1;
                zSign = 1;
                facing = [0, -1];
                break;
        }

        let index = this.SIZE.length;
        const startLocation = event.block.location;
        for( ; index--; index > 0){
            // 匹配
            let size = this.SIZE[index];
            // 生成
            if(this.match(dimension, size.space, startLocation, xSign, zSign)){
                // 生成未烘烤手办
                if(index === 0){
                    // 实体
                    let maid = dimension.spawnEntity("thlmm:maid", new Vector(
                        startLocation.x+0.5, startLocation.y, startLocation.z+0.5
                    ));
                    maid.setDynamicProperty("spawn_set",true);
                    EntityMaid.Statues.scale.set(maid, size.scale);
                    EntityMaid.Statues.space.set(maid, new Vector(size.space[0], size.space[1], size.space[2]));
                    EntityMaid.Skin.setPack(maid, skin.pack);
                    EntityMaid.Skin.setIndex(maid, skin.index);
                    maid.triggerEvent("become_garage_kit_un_solid");
                    
                    maid.teleport(maid.location, {"facingLocation": 
                        new Vector(maid.location.x + facing[0], maid.location.y, maid.location.z + facing[1])});
                    // 占位方块
                    dimension.fillBlocks(new BlockVolume(startLocation, startLocation), blockGarageKit);
                }
                // 生成雕塑
                else{
                    let offset = [xSign*(size.space[0] - 1), size.space[1] - 1, zSign*(size.space[2] - 1)]
                    let endLocation = new Vector(
                        startLocation.x + offset[0], startLocation.y + offset[1], startLocation.z + offset[2]);
                    // 实体
                    let maid = dimension.spawnEntity("thlmm:maid",new Vector(
                        startLocation.x + offset[0]/2 + 0.5, startLocation.y, startLocation.z + offset[2]/2 + 0.5
                    ));
                    maid.setDynamicProperty("spawn_set",true);
                    EntityMaid.Statues.scale.set(maid, size.scale);
                    EntityMaid.Statues.space.set(maid, new Vector(size.space[0], size.space[1], size.space[2]));
                    EntityMaid.Skin.setPack(maid, skin.pack);
                    EntityMaid.Skin.setIndex(maid, skin.index);
                    maid.triggerEvent("become_statues");

                    maid.teleport(maid.location, {"facingLocation": 
                        new Vector(maid.location.x + facing[0], maid.location.y, maid.location.z + facing[1])});
                    // 占位方块
                    dimension.fillBlocks(new BlockVolume(event.block.location, endLocation), blockStatues);
                }

                ItemTool.damageMainHandStack(player);

                // 播放音效
                player.playSound("land.anvil");
                return;
            }
        }
    }

    /**
     * 匹配结构
     * @param {Dimension} dimension 
     * @param {number[]} space 
     * @param {Vector} startLocation 
     * @param {number} xSign 
     * @param {number} zSign 
     * @returns {boolean}
     */
    static match(dimension, space, startLocation, xSign, zSign){
        for(let x = 0; x < space[0]; x++){
            for(let y = 0; y < space[1]; y++){
                for(let z = 0; z < space[2]; z++){
                    try{
                        let block = dimension.getBlock(new Vector(
                            startLocation.x + xSign*x, startLocation.y + y, startLocation.z + zSign*z));
                        if(!isClay(block)){
                            return false;
                        }
                    }
                    catch{
                        return false;
                    }
                }
            }
        }
        return true;
    }
    /**
     * 结构完整性扫描
     * @param {DataDrivenEntityTriggerAfterEvent} event 
     */
    static scan(event){
        let maid = event.entity;
        switch(EntityMaid.Work.get(maid)){
            case -2:{ // 雕塑 恢复构造前状态
                let space = EntityMaid.Statues.space.get(maid);
                let startLocation = new Vector(
                    maid.location.x - space.x/2+0.5,
                    maid.location.y,
                    maid.location.z - space.z/2+0.5
                );
                let endLocation = new Vector(
                    startLocation.x + space.x - 1,
                    startLocation.y + space.y - 1,
                    startLocation.z + space.z - 1
                )
                
                // 使用fill，提高对大体积区域的检测速度
                let statuesBlocks = maid.dimension.getBlocks(
                    new BlockVolume(startLocation, endLocation), 
                    {"includeTypes": [blockStatues]},
                    true
                );
                if(statuesBlocks.getCapacity() < space.x*space.y*space.z){
                    maid.dimension.fillBlocks(statuesBlocks, "minecraft:clay");
                    EntityMaid.despawn(maid);
                }
            }; break;
            case -3:{
                /**
                 * 未固化手办
                 *  由方块掉落黏土，实体只需要自行消失
                 *  生存模式破坏会由方块事件销毁实体，下面的操作一般只会在创造模式破坏后手动执行
                 */
                let block = maid.dimension.getBlock(maid.location);
                if(block === undefined || block.typeId !== blockGarageKit){
                    EntityMaid.despawn(maid);
                }
            }; break;
            case -4:{
                /**
                 * 固化手办
                 *  掉落手办
                 */
                let block = maid.dimension.getBlock(maid.location);
                if(block === undefined || block.typeId !== blockGarageKit){
                    // 创建物品
                    let item = new ItemStack("touhou_little_maid:garage_kit", 1);
                    let pack = EntityMaid.Skin.getPack(maid);
                    let index = EntityMaid.Skin.getIndex(maid);
                    // item.nameTag = JSON.stringify({rawtext:[MaidSkin.getSkinDisplayName(pack, index)]}); // 无法显示translate文本
                    
                    // 设置属性
                    item.setLore([`${pack},${index}`]);
                    
                    // 生成物品
                    maid.dimension.spawnItem(item, maid.location);

                    /// 销毁实体
                    EntityMaid.despawn(maid);
                }
            }; break;
            default: break;
        }
    }
    /**
     * 手办放置事件
     * @param {ItemUseOnBeforeEvent} event 
     */
    static placeEvent(event){
        // 检测被交互的方块是否会复制物品
        if(isBadContainerBlock(event.block.typeId)) return;

        // 决定位置  PS: faceLocation 是交互面上被点的坐标
        let location = event.block.location;
        switch(event.blockFace){
            case Direction.Down: location.y--; break;
            case Direction.Up  : location.y++; break;
            case Direction.East: location.x++; break;
            case Direction.West: location.x--; break;
            case Direction.South: location.z++; break;
            case Direction.North: location.z--; break;
            default: return;
        }
        
        // 可放置判断
        let player = event.source;
        let dimension = player.dimension;
        const block = dimension.getBlock(location);
        if(!block.isAir) return;

        // 决定方向 xz
        let rotation = player.getRotation();

        // 放置方块
        dimension.fillBlocks(new BlockVolume(location, location), 
            BlockPermutation.resolve(blockGarageKit, {"thlm:solid": true}));

        ///// 放置实体 /////
        location.x += 0.5;
        location.z += 0.5;
        let maid = dimension.spawnEntity("thlmm:maid", location);
        maid.setDynamicProperty("spawn_set",true);
        
        // 解析物品信息
        let item = event.itemStack;
        let lore = item.getLore();
        if(lore===undefined || lore.length===0) return;
        let infoStr = lore[0].split(',');
        
        let size = this.SIZE[0];
        EntityMaid.Statues.scale.set(maid, size.scale);
        EntityMaid.Statues.space.set(maid, new Vector(size.space[0], size.space[1], size.space[2]));
        EntityMaid.Skin.setPack(maid, Number(infoStr[0]));
        EntityMaid.Skin.setIndex(maid, Number(infoStr[1]));
        maid.triggerEvent("become_garage_kit_solid");
        rotation.x = 0;
        if(rotation.y >= 0){
            if(rotation.y < 45) rotation.y = 0;
            else if(rotation.y < 135) rotation.y = 90;
            else rotation.y = 180;
            rotation.y -= 180;
        }
        else{
            if(rotation.y > -45) rotation.y = 0;
            else if(rotation.y > -135) rotation.y = -90;
            else rotation.y = 180;
            rotation.y += 180;
        }
        maid.setRotation(rotation);

        // 消耗物品
        let container = player.getComponent("inventory").container;
        let slot = player.selectedSlotIndex;
        if(event.itemStack.amount===1){
            container.setItem(slot);
        }
        else{
            let itemStack = container.getItem(slot);
            itemStack.amount --;
            container.setItem(slot, itemStack);
        }
        // 取消交互 避免物品再次被其它事件使用
        event.cancel = true;
    }
}

/**
 * 
 * @param {Block} block
 * @returns {Boolean} 
 */
function isClay(block) {
    return block===undefined ? false : block.typeId === "minecraft:clay";
} 