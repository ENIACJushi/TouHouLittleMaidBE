/**
 * 女仆tag
 * thlmo:<主人生物id>
 * thlmh:<家坐标x>,<家坐标y>,<家坐标z>,<维度> (整数)
 * thlmb:<背包生物id>
 */
/**
 * 背tag
 *  thlmm:<女仆id>
 *  thlmo:<主人生物id>
 */
import { Direction, ItemStack, world, DataDrivenEntityTriggerAfterEvent, system, System, EntityDieAfterEvent, ItemUseOnBeforeEvent, Dimension, EntityHurtAfterEvent, EntityHitEntityAfterEvent, Entity, Player } from "@minecraft/server";
import { Vector, VectorMC } from "../libs/VectorMC";
import * as Tool from "../libs/ScarletToolKit"
import * as UI from "./MaidUI"
import { EntityMaid } from './EntityMaid';
import { StrMaid } from "./StrMaid";
import {DanmakuShoot}  from "../danmaku/DanmakuShoot";
import {DanmakuColor}  from "../danmaku/DanmakuColor";
import {DanmakuType}   from "../danmaku/DanmakuType";
import { shoot as cherryShoot } from "../danmaku/custom/Cherry";
import { Cocoa, Farm, MaidTarget, Melon } from "./MaidTarget";
import { isBadContainerBlock } from "../../data/BadContainerBlocks";
import * as DP from '../libs/DynamicPropertyInterface'

const HOME_RADIUS=32;

export class MaidManager{
    ///// 核心事件 /////
    static Core = class{
        /**
         * 初始化事件
         */
        static init(){
            
        }
        /**
         * 女仆生成事件
         * @param {DataDrivenEntityTriggerAfterEvent} event 
         */
        static onSpawnEvent(event){
            let maid = event.entity;
            maid.triggerEvent("api:init_success");
            EntityMaid.init_maid(maid);
        }
        /**
         * 女仆寄事件
         * @param {DataDrivenEntityTriggerAfterEvent} event 
         */
        static onDeathEvent(event){
            let maid = event.entity;
            if(maid===undefined) return;

            let lore = EntityMaid.toLore(maid, false);
            let output_item = new ItemStack("touhou_little_maid:film", 1);
            output_item.setLore(lore);
            
            // 转移背包物品
            let tombstone = maid.dimension.spawnEntity("touhou_little_maid:tombstone", maid.location);
            let stoneContainer = tombstone.getComponent("inventory").container;
            let maidContainer = maid.getComponent("inventory").container;

            for(let i = 0; i < maidContainer.size; i++){
                let maidItem = maidContainer.getItem(i);
                if(maidItem !== undefined){
                    stoneContainer.setItem(i, maidItem);
                    maidContainer.setItem(i);
                }
            }
            
            // 放入胶片
            stoneContainer.addItem(output_item);
            
            // 命名
            let ownerName = EntityMaid.Owner.getName(maid);;
            if(ownerName !== undefined){
                tombstone.nameTag = "§aOwner\n§e" + ownerName;
                DP.setString(tombstone, "owner_name", ownerName);
            }
            // 主人信息
            let owenrId = EntityMaid.Owner.getID(maid);
            if(owenrId !== undefined){
                DP.setString(tombstone, "owner_id", owenrId);
            }
        }
        /**
         * 女仆被驯服事件
         * @param {DataDrivenEntityTriggerAfterEvent} event
         */
        static onTamed(event){
            let maid = event.entity;

            EntityMaid.Level.eventTamed(maid, EntityMaid.Level.get(maid));

            // 设置主人
            EntityMaid.Owner.refresh(maid);
            
            // 设置工作模式
            let work = maid.getDynamicProperty("temp_work");
            if(work !== undefined){
                EntityMaid.Work.set(maid, work);
                maid.setDynamicProperty("temp_work");
            }
            
            // 播放语音 从魂符、照片、祭坛复活的女仆不会播放
            
            EntityMaid.Sound.tamed(maid);
        }
        /**
         * 坟墓受击
         * @param {DataDrivenEntityTriggerAfterEvent} event
         */
        static tombstoneAttackEvent(event){
            let tombstone = event.entity;
            let dimension = tombstone.dimension;
            // 主人验证
            let ownerName = DP.getString(tombstone, "owner_name");
            if(ownerName !== undefined){
                let player = dimension.getPlayers({"name": ownerName, "location": tombstone.location, "maxDistance": 6});
                if(player.length === 0){
                    let ownerID = DP.getString(tombstone, "owner_id");
                    if(ownerID !== undefined){
                        let player = world.getEntity(ownerID);
                        if(VectorMC.length(VectorMC.sub(player.location, tombstone.location)) > 6){
                            return;
                        }
                    }
                }
            }

            let container = tombstone.getComponent("inventory").container;

            for(let i = 0; i < container.size; i++){
                let item = container.getItem(i)
                if(item !== undefined){
                    dimension.spawnItem(item.clone(), tombstone.location);
                    container.setItem(i);
                }
            }

            tombstone.triggerEvent("despawn");
        }
    }
    ///// 交互事件 /////
    static Interact = class{
        /**
        * 主人与女仆交互事件（左键）
        * @param {DataDrivenEntityTriggerAfterEvent} event
        */
        static onInteractEvent(event){
            let maid = event.entity;
            // Search for owner
            let pl_id = EntityMaid.Owner.getID(maid);
            if(pl_id!==undefined){
                let pl = world.getEntity(pl_id);
                // Send form
                UI.MainMenu(pl, event.entity);
                return true;
            }
            return false;
        }
        /**
         * 女仆被拍照事件
         * @param {DataDrivenEntityTriggerAfterEvent} event 
         */
        static onPhotoEvent(event){
            let maid = event.entity;
            if(maid===undefined) return;

            let owner = EntityMaid.Owner.get(maid);
            if(owner === undefined) return;

            let lore = EntityMaid.toLore(maid);
            
            // 发出声音
            EntityMaid.playSound(maid, "thlm.camera_use");
            
            // 输出照片
            let location = maid.location;
            location.y += 0.5;
            let output_item = new ItemStack("touhou_little_maid:photo", 1);
            output_item.setLore(lore);
            let maidnName = EntityMaid.getNameTag(maid);
            if(maidnName !== ""){
                output_item.nameTag = `§z${maidnName}`;
            }
            if(maid.dimension.spawnItem(output_item, owner.location) !== undefined){
                // 清除女仆
                EntityMaid.Pick.set(maid, false);// 避免捡完东西被消除
                maid.triggerEvent("despawn");
            }
        }
        
        /**
         * 根据方块和一个方向获得可以放置女仆的位置
         * 用于魂符和相片的放置
         * @param {Dimension} dimension 
         * @param {Location} location 
         * @param {Direction} blockFace 
         * @returns {Location|undefined}
         */
        static getSafeLocation(dimension, _location, blockFace){
            let location = _location;
            // 决定位置
            switch(blockFace){
                case Direction.Down: location.y--; break;
                case Direction.Up  : location.y++; break;
                case Direction.East: location.x++; break;
                case Direction.West: location.x--; break;
                case Direction.South: location.z++; break;
                case Direction.North: location.z--; break;
                default: return;
            }
            if(!EntityMaid.isSafeBlock(dimension.getBlock(location))){
                return undefined;
            }
            // 上
            const locationUp = new Vector(location.x, location.y+1, location.z);
            if(!EntityMaid.isSafeBlock(dimension.getBlock(locationUp))){
                // 下
                const locationDown = new Vector(location.x, location.y-1, location.z);
                if(EntityMaid.isSafeBlock(dimension.getBlock(location))){
                    return locationDown;
                }
                else{
                    return undefined;
                }
            }
            return location;
        }
        /**
         * 照片使用事件
         * 当照片无 lore 或 使用者不为主人时，使用失败
         * @param {ItemUseOnBeforeEvent} event 
         */
        static photoOnUseEvent(event){
            let lore = event.itemStack.getLore();
            if(lore.length === 0) return; // 无lore

            //// 检测被交互的方块是否会复制物品 ////
            if(isBadContainerBlock(event.block.typeId)) return;

            //// 检测放置位置是否有两格空间 ////
            const player = event.source;
            const dimension = player.dimension;
            let location = this.getSafeLocation(dimension, event.block.location, event.blockFace);
            if(location === undefined){
                Tool.title_player_actionbar_translate(player.name, "message.touhou_little_maid:photo.not_suitable_for_place_maid.name");
                return;
            }
            location.x+=0.5;
            location.z+=0.5;

            // 转换lore
            let strPure = Tool.lore2Str(lore);

            // 使用者不是主人
            if(StrMaid.Owner.getId(strPure) !== event.source.id) return;
            
            // 放置
            let maid = EntityMaid.fromStr(strPure, dimension, location, true);
            
            // 消耗照片
            Tool.setPlayerMainHand(event.source);
        }
        /**
         * 魂符使用事件
         * @param {ItemUseOnBeforeEvent} event 
         */
        static smartSlabOnUseEvent(event){
            let itemStack = event.itemStack;
            let lore = itemStack.getLore();

            //// 检测被交互的方块是否会复制物品 ////
            if(isBadContainerBlock(event.block.typeId)) return;

            //// 检测放置位置是否有两格空间 ////
            const player = event.source;
            const dimension = player.dimension;
            let location = this.getSafeLocation(dimension, event.block.location, event.blockFace);
            if(location === undefined){
                Tool.title_player_actionbar_translate(player.name, "message.touhou_little_maid:photo.not_suitable_for_place_maid.name");
                return;
            }
            location.x+=0.5;
            location.z+=0.5;

            // 生成女仆
            let maid = undefined;
            let itemName = itemStack.nameTag;
            if(lore.length === 0){
                // 首次使用
                maid = EntityMaid.spawnRandomMaid(dimension, location);
                try{
                    EntityMaid.Skin.setRandom(maid);
                    system.runTimeout(()=>{
                        EntityMaid.Owner.set(maid, player);
                    },1)
                }
                catch{}
            }
            else{
                try{
                    // 转换lore
                    let str = Tool.lore2Str(lore);

                    // 使用者不是主人
                    if(StrMaid.Owner.getId(str) !== event.source.id) return;

                    // 放置
                    maid = EntityMaid.fromStr(str, dimension, location, true);
                }
                catch{}
            }
            // 没有成功召唤 直接退出
            if(maid === undefined){ return; }
            
            // 转换物品
            let emptyItem = new ItemStack("touhou_little_maid:smart_slab_empty", 1);
            if(itemName !== undefined && itemName.substring(0,2) !== "§z"){
                emptyItem.nameTag = itemName;
            }
            
            Tool.setPlayerMainHand(event.source, emptyItem);
        }
        /**
         * 女仆被魂符收回事件
         * @param {DataDrivenEntityTriggerAfterEvent} event 
         */
        static onSmartSlabRecycleEvent(event){
            let maid = event.entity;
            if(maid===undefined) return;

            // 获取魂符物品
            let owner = EntityMaid.Owner.get(maid);
            if(owner === undefined) return;
            let item = Tool.getPlayerMainHand(owner);
            if(item === undefined || item.typeId !== "touhou_little_maid:smart_slab_empty") return;

            // 将女仆转为lore
            let lore = EntityMaid.toLore(maid);
            
            // 清除女仆
            EntityMaid.Pick.set(maid, false);// 避免捡完东西被消除
            maid.triggerEvent("despawn");

            // 修改魂符
            let new_itme = new ItemStack("touhou_little_maid:smart_slab_has_maid", 1);
            if(item.nameTag === undefined){
                let maidnName = EntityMaid.getNameTag(maid);
                if(maidnName !== ""){
                    new_itme.nameTag = `§z${maidnName}`;
                }
            }
            else{
                if(item.nameTag.substring(0,2) !== ""){
                    new_itme.nameTag = item.nameTag;
                }
            }
            new_itme.setLore(lore);
            Tool.setPlayerMainHand(owner, new_itme);
        }
        /**
         * 女仆坐下事件
         * @param {DataDrivenEntityTriggerAfterEvent} event
         */
        static onSitEvent(event){
            let maid = event.entity;
            
            // 工作模式
            switch(EntityMaid.Work.get(maid)){
                case EntityMaid.Work.attack    : EntityMaid.Work.quit(maid); break; // 取消近战模式
                case EntityMaid.Work.farm      : EntityMaid.Work.quit(maid); break; // 退出农作模式
                case EntityMaid.Work.sugar_cane: EntityMaid.Work.quit(maid); break; // 退出甘蔗模式
                case EntityMaid.Work.melon     : EntityMaid.Work.quit(maid); break; // 退出瓜类模式
                case EntityMaid.Work.cocoa     : EntityMaid.Work.quit(maid); break; // 退出可可模式
            }

            // 拾物模式
            if(EntityMaid.Pick.get(maid)){
                EntityMaid.Pick.set(maid, true);
            }
        }
        /**
         * 女仆站起事件
         * @param {DataDrivenEntityTriggerAfterEvent} event
         */
        static onStandEvent(event){
            let maid = event.entity;
            
            // 工作模式
            switch(EntityMaid.Work.get(maid)){
                case EntityMaid.Work.attack    : EntityMaid.Work.enter(maid, EntityMaid.Work.attack    ); break; // 恢复近战模式
                case EntityMaid.Work.farm      : EntityMaid.Work.enter(maid, EntityMaid.Work.farm      ); break; // 恢复农作模式
                case EntityMaid.Work.sugar_cane: EntityMaid.Work.enter(maid, EntityMaid.Work.sugar_cane); break; // 恢复甘蔗模式
                case EntityMaid.Work.melon     : EntityMaid.Work.enter(maid, EntityMaid.Work.melon     ); break; // 恢复瓜类模式
                case EntityMaid.Work.cocoa     : EntityMaid.Work.enter(maid, EntityMaid.Work.cocoa     ); break; // 恢复可可模式
            }
            MaidTarget.search(maid, 15);
            
            // 拾物模式
            if(EntityMaid.Pick.get(maid)){
                EntityMaid.Pick.set(maid, true);
            }
        }
        /**
         * 模式切换为坐下，此时主人状态由潜行切换到站立
         * @param {DataDrivenEntityTriggerAfterEvent} event
         */
        static sitModeEvent(event){
            let maid = event.entity;
            EntityMaid.Backpack.quitCheckMode(maid);
            EntityMaid.Emote.set(maid, 0);
        }
        /**
         * 模式切换为背包操作，此时主人状态由站立切换到潜行
         * @param {DataDrivenEntityTriggerAfterEvent} event
         */
        static inventoryModeEvent(event){
            let maid = event.entity;
            EntityMaid.Backpack.checkMode(maid); 
            EntityMaid.Emote.backpack(maid);
        }
        /**
         * 背包种类切换
         * @param {DataDrivenEntityTriggerAfterEvent} event
         * @param {number} typeNew 1, 2, 3 
         */
        static backpackTypeChangeEvent(event, typeNew){
            let maid = event.entity;
            let typeOld = EntityMaid.Backpack.getType(maid);
            let dimension = maid.dimension;
            let location = maid.location;

            // 将多余的物品丢出
            if(typeOld > typeNew){
                let container = EntityMaid.Backpack.getContainer(maid);
                for(let i = EntityMaid.Backpack.getCapacity(typeNew); i < EntityMaid.Backpack.getCapacity(typeOld); i++){
                    let item = container.getItem(i);
                    if(item !== undefined){
                        dimension.spawnItem(item, location);
                        container.setItem(i);
                    }
                }
            }
            
            // 升级
            EntityMaid.Backpack.setType(maid, typeNew);
            system.runTimeout(()=>{EntityMaid.Emote.backpack(maid);},1); // 延迟1刻等待修改生效
            
            // 返还旧背包
            if(typeOld !== 0){
                dimension.spawnItem(new ItemStack(EntityMaid.Backpack.getItemName(typeOld), 1), location);
            }
        }
    }
    ///// 日程事件 /////
    static Shedule = class{
        /**
         * 回家事件
         * @param {DataDrivenEntityTriggerAfterEvent} event
         */
        static returnHomeEvent(event){
            // 比较维度
            let maid = event.entity;
            // NPC的家半径为 2
            let homeRadius = EntityMaid.Work.get(maid)===-1 ? 2 : HOME_RADIUS;

            let home_location = EntityMaid.Home.getLocation(maid);

            // 没有家，设置为当前位置
            if(home_location===undefined){
                EntityMaid.Home.setLocation(maid);
                return; 
            }
            let in_home = (maid.dimension.id===home_location[3]);
            if(in_home){
                // 计算范围
                in_home = Tool.pointInArea_2D(maid.location.x, maid.location.z,
                    home_location[0] - homeRadius, home_location[2] - homeRadius,
                    home_location[0] + homeRadius, home_location[2] + homeRadius);
            }
            // 维度不同或超出范围，回家
            world.getDimension(home_location[3]);
            if(!in_home){
                maid.teleport(new Vector(home_location[0], home_location[1], home_location[2]),
                {"dimension": world.getDimension(home_location[3])});
            }
        }
        /**
         * 定时事件
         * @param {DataDrivenEntityTriggerAfterEvent} event 
         */
        static timerEvent(event){
            const STEP_MAX = 1000;
            let maid = event.entity; 
            if(maid===undefined) return;

                ///// 步数计算 一步3秒 /////
                let healStep = maid.getDynamicProperty("step");
                // 计时量未初始化 立即初始化
                if(healStep === undefined){
                    maid.setDynamicProperty("step", 0);
                    return;
                }
                if(healStep >= STEP_MAX){
                    maid.setDynamicProperty("step", 0);
                }
                else{
                    maid.setDynamicProperty("step", healStep+1);
                }

                ///// 取模决定执行任务 /////
                //// 每次
                // 抱起扫描
                if(maid.getProperty("thlm:is_hug")) MaidManager.Hug.maidScan(maid);
                
                let work = EntityMaid.Work.get(maid);
                // 农业扫描
                switch(work){ 
                    case EntityMaid.Work.farm : 
                    case EntityMaid.Work.melon:
                    case EntityMaid.Work.cocoa: MaidTarget.stepEvent(maid, work); break;
                    default: break;
                }
                if(world.gameRules.mobGriefing === false && EntityMaid.Pick.get(maid) === true){ // 无生物破坏的拾物模式
                    system.runTimeout(()=>{
                        EntityMaid.Pick.magnet(maid, 5);
                    }, 2);// 延迟执行，更及时地捡起农作物
                }
                try{
                // 使用质数 2 3 5 7 11 13 17 19
                // 3步 - 9秒
                if(healStep % 3 === 0){
                    // 回血
                    try{
                        let healthComponent = EntityMaid.Health.getComponent(maid);
                        if(healthComponent.currentValue < healthComponent.defaultValue){
                            // 回血
                            let healAmount = EntityMaid.Level.getProperty(maid, "heal");
                            healthComponent.setCurrentValue(
                                Math.min(healthComponent.defaultValue,
                                healthComponent.currentValue + Tool.getRandomInteger(healAmount[0], healAmount[1])));
                        }
                    }
                    catch{}
                    // 扫描 坐下时不执行
                    try{
                        if(!EntityMaid.isSitting(maid)){
                            MaidTarget.search(maid, 15);
                        }
                    }
                    catch{}
                }
                // 11步 - 33秒
                else if(healStep % 11 === 0){
                    // 播放idle语音
                    if(!EntityMaid.Mute.get(maid)){
                        system.runTimeout(()=>{
                            try{
                                EntityMaid.playSound(maid, "mob.thlmm.maid.idle");
                            }
                            catch{}
                        }, Tool.getRandomInteger(0, 100));
                    }
                }
            }
            catch{ }
            
        }
        /**
         * 女仆击杀
         * 调用此事件时 event.damageSource.damagingEntity 必定存在且为女仆
         * @param {EntityDieAfterEvent} event 
         */
        static killEvent(event){
            let maid = event.damageSource.damagingEntity;
            let oldAmount = EntityMaid.Kill.get(maid);
            EntityMaid.Kill.set(maid, oldAmount+1);
        }
        /**
         * 弹幕攻击
         * @param {DataDrivenEntityTriggerAfterEvent} event 
         */
        static danmakuAttack(event){
            const AIMED_SHOT_PROBABILITY = 0.8; //java 0.9
            let maid = event.entity;
            if(maid===undefined) return;

            let target = maid.target
            if(target != undefined){
                let basicDamage = EntityMaid.Level.getProperty(maid, "danmaku");

                // 目标为幻翼时，使用樱花束攻击
                if(target.typeId === "minecraft:phantom"){// 无效：target.getComponent("minecraft:can_fly") !== undefined
                    let location = maid.getHeadLocation()
                    let direction = new Vector(target.location.x - location.x,
                        target.location.y - location.y,
                        target.location.z - location.z);
                    cherryShoot(maid, location, direction, basicDamage, basicDamage/3, 1);
                    return;
                }

                // 默认攻击方式
                let distance = VectorMC.length(new Vector(
                    maid.location.x - maid.target.location.x,
                    maid.location.y - maid.target.location.y,
                    maid.location.z - maid.target.location.z,));
                let distanceFactor = distance / 8;
                let yOffset = distance < 5 ? 0.2 : 0.5; // 根据距离偏移目标位置

                // 数量判定
                let monsters = maid.dimension.getEntities({"location": maid.location, "families":["monster"], "maxDistance":20});
                // 群攻
                if(monsters.length > 4){
                    const amount = 3;
                    const delta = 0.8;// 伤害系数
                    let random = Tool.getRandomInteger(0, 1);
                    switch(random){
                        case 0:{
                            // 中程密集扇形弹幕
                            let shoot = DanmakuShoot.create().setWorld(maid.dimension).setThrower(maid).setThrowerOffSet(new Vector(0, 1, 0))
                            .setTargetOffSet(new Vector(0, yOffset, 0)).setOwnerID(EntityMaid.Owner.getID(maid))
                            .setRandomColor().setRandomType()
                            .setDamage((distanceFactor + basicDamage + 0.5)*delta/amount).setGravity(0)
                            .setVelocity(0.5 * (distanceFactor + 1))
                            .setInaccuracy(0.02).setFanNum(12).setYawTotal(Math.PI/2).setLifeTime(30)
                            for(let i = 0; i < amount; i++){
                            system.runTimeout(()=>{
                                shoot.setTarget(maid.target)
                                .setRandomColor().setRandomType().fanShapedShot();
                            }, i*20);
                            }
                        }; break;
                        case 1:{
                            // 星弹
                            var aimDanmakuShoot_small = DanmakuShoot.create().setWorld(maid.dimension)
                            .setThrower(maid).setTarget(maid.target).setThrowerOffSet(new Vector(0, 1, 0))
                            .setTargetOffSet(new Vector(0, yOffset, 0)).setColor(DanmakuColor.RANDOM).setType(DanmakuType.STAR)
                            .setDamage((distanceFactor + basicDamage + 0.5)*delta/18).setGravity(0).setLifeTime(40)
                            .setVelocity(0.5 * (distanceFactor + 1)).setInaccuracy(Math.PI/7);
                            
                            var aimDanmakuShoot_big =DanmakuShoot.create().setWorld(maid.dimension)
                            .setThrower(maid).setThrowerOffSet(new Vector(0, 1, 0)).setTargetOffSet(new Vector(0, yOffset, 0))
                            .setLifeTime(45).setColor(DanmakuColor.RANDOM).setType(DanmakuType.BIG_STAR)
                            .setDamage((distanceFactor + basicDamage + 0.5)*delta/10).setGravity(0)
                            .setVelocity(0.5 * (distanceFactor + 1)).setInaccuracy(Math.PI/15);
                            for(let i=0; i<5;i++){
                                system.runTimeout(()=>{
                                    aimDanmakuShoot_big.setTarget(maid.target).setVelocity(Tool.getRandom(0.3, 1)).aimedShot();
                                }, i*8);
                                system.runTimeout(()=>{
                                    aimDanmakuShoot_small.setTarget(maid.target).setVelocity(Tool.getRandom(0.3, 1)).aimedShot();
                                }, 1+i*8);
                                system.runTimeout(()=>{
                                    aimDanmakuShoot_small.setTarget(maid.target).setVelocity(Tool.getRandom(0.3, 1)).aimedShot();
                                }, 2+i*8);
                                system.runTimeout(()=>{
                                    aimDanmakuShoot_big.setTarget(maid.target).setVelocity(Tool.getRandom(0.3, 1)).aimedShot();
                                }, 3+i*8);
                                system.runTimeout(()=>{
                                    aimDanmakuShoot_small.setTarget(maid.target).setVelocity(Tool.getRandom(0.3, 1)).aimedShot();
                                }, 4+i*8);
                            }
                        }; break;
                        default:break;
                    }
                }
                // 单体
                else{
                    const amount = 4;
                    let shoot = DanmakuShoot.create().setWorld(maid.dimension).setThrower(maid)
                        .setThrowerOffSet(new Vector(0, 1, 0)).setTargetOffSet(new Vector(0, yOffset, 0))
                        .setOwnerID(EntityMaid.Owner.getID(maid))
                        .setDamage((distanceFactor + basicDamage)/amount).setGravity(0)
                        .setVelocity(0.5 * (distanceFactor + 1)).enablePreJudge()
                        .setInaccuracy(0.05);
                    
                    for(let i = 0; i < amount; i++){
                        system.runTimeout(()=>{
                            shoot.setTarget(maid.target).setRandomColor().setRandomType().aimedShot();
                        }, i*12);
                    }
                }
            }
        }
    }

    static Hug = class{
        /**
         * 抱起来
         * @param {DataDrivenEntityTriggerAfterEvent} event
         */
        static startEvent(event){
            // 抱起事件是坐下事件的父集
            MaidManager.Interact.onSitEvent(event);
            
            // 开始抱起
            let maid = event.entity;
            let player = EntityMaid.Owner.get(maid);
            const dimension = maid.dimension;
            
            // 只能抱起一名女仆，如果有鹦鹉也不行，因为位置会乱
            let rideComponent = player.getComponent("rideable");
            let riders = rideComponent.getRiders();
            if(riders.length != 0) return;
            
            // 由坐下模式转抱起模式
            maid.triggerEvent("api:sit_to_hug");
            system.runTimeout(()=>{
                // 让女仆坐上玩家
                if(rideComponent.addRider(maid)){
                    // 生成交互实体
                    this.summonInteractEntity(maid, player);
                    // 设置女仆属性
                    maid.setProperty("thlm:is_hug", true);
                    // 玩家动画
                    this.startAnimate(player);
                }
                else{
                    // 失败，返回坐下模式
                    maid.triggerEvent("api:hug_to_sit");
                }
            },1);
        }
        /**
         * 生成交互实体
         * @param {Entity} maid 
         * @param {Player} player 
         */
        static summonInteractEntity(maid, player){
            let hugMaid = player.dimension.spawnEntity("touhou_little_maid:hug_maid", new Vector(
                player.location.x,
                -60,
                player.location.z
            ));
            hugMaid.getComponent("tameable").tame(player);
            // 坐上女仆
            let maidComponent = maid.getComponent("rideable");
            maidComponent.addRider(hugMaid);
            // 设置女仆id
            hugMaid.setDynamicProperty("maid", maid.id);
        }
        /**
         * 放下去 (交互事件 三个实体都是正常状态 由交互实体触发)
         * @param {DataDrivenEntityTriggerAfterEvent} event
         */
        static stopEvent(event){
            let id = event.entity.getDynamicProperty("maid");
            if(id === undefined){
                event.entity.remove();
                return;
            }
            let maid = world.getEntity(id);
            if(maid === undefined){
                event.entity.remove();
                return;
            }
            this.stop(maid)
        }
        /**
         * 放下去
         * @param {Entity} maid 
         */
        static stop(maid){
            // 删除交互实体
            let seat = maid.getComponent("rideable").getRiders();
            if(seat.length !== 0){
                seat[0].remove();
            }

            // 返回坐下模式
            maid.triggerEvent("api:hug_to_sit");

            // 恢复属性
            maid.setProperty("thlm:is_hug", false);

            // 恢复玩家动画
            let player = EntityMaid.Owner.get(maid);
            if(player !== undefined){
                this.stopAnimate(player);
                player.getComponent("rideable").ejectRider(maid);
            }
        }
        /**
         * 中间实体扫描
         * @param {DataDrivenEntityTriggerAfterEvent} event
         */
        static seatScan(event){
            try{
                let seat = event.entity;
                if(seat === undefined) return;
                let maids = seat.dimension.getEntities({
                    "location": seat.location,
                    "maxDistance": 1,
                    "families": ["maid"]
                });
                if(maids.length === 0){
                    seat.remove();
                }
            }
            catch{}
        }
        /**
         * 女仆扫描
         * @param {Entity} maid
         */
        static maidScan(maid){
            // 若脱离玩家则退出抱起状态
            let player = EntityMaid.Owner.get(maid);
            let quit = true;

            if(player !== undefined){
                for(let rider of player.getComponent("rideable").getRiders()){
                    if(rider.id === maid.id){
                        quit = false;
                        break;
                    }
                }
            }

            if(quit){
                this.stop(maid);
                return;
            }

            // 若交互实体消失则补一个
            if(maid.getComponent("rideable").getRiders().length === 0){
                // 生成交互实体
                this.summonInteractEntity(maid, player);
            }
        }
        
        /**
         * 停止抱起动画
         * @param {Player} player 
         */
        static stopAnimate(player){
            player.runCommand("playanimation @s animation.thlm.player.hug_maid_stop animation.thlm.player.hug_maid_stop");
        }
        /**
         * 开始抱起动画
         * @param {Player} player 
         */
        static startAnimate(player){
            player.runCommand("playanimation @s animation.thlm.player.hug_maid animation.thlm.player.hug_maid 9999");
            player.runCommand("playanimation @s animation.thlm.player.hug_maid");
        }
    }
    
    ///// 其它事件 /////
    /**
     * 开盒，生成一只随机女仆
     * @param {DataDrivenEntityTriggerAfterEvent} event
     */
    static boxOpenEvent(event){
        let box = event.entity;
        EntityMaid.spawnRandomMaid(box.dimension, box.location);
        EntityMaid.playSound(box, "thlm.box");
        box.triggerEvent("despawn");
    }
    /**
     * 等级设置
     * @param {DataDrivenEntityTriggerAfterEvent} event 
     */
    static setLevelEvent(event){
        let maid = event.entity;
        if(maid===undefined) return;

        let level = parseInt(event.id.substring(7));
        EntityMaid.Level.set(maid, level);
    }
    /**
     * 女仆成为 NPC
     * @param {DataDrivenEntityTriggerAfterEvent} event 
     */
    static onNPCEvent(event){
        let maid = event.entity;
        if(maid===undefined) return;
        
        EntityMaid.Home.setLocation(maid);
        EntityMaid.Emote.clear(maid);
    }
    /**
     * NPC 交互
     * @param {DataDrivenEntityTriggerAfterEvent} event 
     */
    static NPCInteract(event){
        let maid = event.entity;
        if(maid===undefined) return;

        let players = maid.dimension.getPlayers({location:maid.location, maxDistance: 6})
        for(let pl of players){
            let item = Tool.getPlayerMainHand(pl);
            if(item !== undefined && item.typeId === "touhou_little_maid:npc_tool"){
                // 发送表单
                UI.SkinMenu(pl, maid, false);
                return;
            }
        }
    }
}
