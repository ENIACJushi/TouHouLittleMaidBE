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
import { Direction, ItemStack, world, Entity, Vector, DataDrivenEntityTriggerBeforeEvent, ItemDefinitionTriggeredBeforeEvent, system, System, EntityDieAfterEvent, ItemUseOnBeforeEvent, Dimension, EntityHurtAfterEvent, EntityHitEntityAfterEvent } from "@minecraft/server";
import * as Tool from "../libs/scarletToolKit"
import * as UI from "./MaidUI"
import { EntityMaid } from './EntityMaid';
import { MaidBackpack } from "./MaidBackpack";
import { config } from "../controller/Config"
import { StrMaid } from "./StrMaid";
import * as Vec from "../libs/vector3d"
import {DanmakuShoot}  from "../danmaku/DanmakuShoot";
import {DanmakuColor}  from "../danmaku/DanmakuColor";
import {DanmakuType}   from "../danmaku/DanmakuType";
import { shoot as cherryShoot } from "../danmaku/custom/Cherry";

const HOME_RADIUS=32;

export class MaidManager{
    /**
     * 初始化事件
     */
    static init(){
        MaidBackpack.loader.init();
    }
    /**
     * 女仆生成事件
     * @param {DataDrivenEntityTriggerBeforeEvent} event 
     */
    static onSpawnEvent(event){
        let maid = event.entity;
        
        // 设置动态属性
        EntityMaid.initDynamicProperties(maid);
        system.runTimeout(()=>{
            // 首次生成选择随机皮肤
            if(!EntityMaid.Owner.has(maid)){
                EntityMaid.Skin.setRandom(maid);
            }
        },1);
        // 生成默认背包 ，为脚本召唤背包预留2刻
        system.runTimeout(()=>{
            try{
                let maid = event.entity;
                if(maid===undefined) return;

                var rideable = maid.getComponent("minecraft:rideable");
                const rider = rideable.getRiders()[0];
                if(rider === undefined){
                    // 生成背包
                    var backpack = MaidBackpack.create(maid, MaidBackpack.default, maid.dimension, maid.location);
                    EntityMaid.Backpack.setID(maid, backpack.id);

                    // 背上背包   无效：rideable.addRider(backpack);
                    maid.runCommand("ride @e[c=1,type=touhou_little_maid:maid_backpack] start_riding @s");
                }
            }
            catch{};
        }, 2);
    }
    
    /**
     * 女仆被拍照事件
     * @param {DataDrivenEntityTriggerBeforeEvent} event 
     */
    static onPhotoEvent(event){
        let maid = event.entity;
        if(maid===undefined) return;

        let lore = EntityMaid.toLore(maid);
        
        // 发出声音
        EntityMaid.playSound(maid, "thlm.camera_use");
        
        // 输出照片
        let location = maid.location;
        location.y += 0.5;
        let output_item = new ItemStack("touhou_little_maid:photo", 1);
        output_item.setLore(lore);
        if(maid.dimension.spawnItem(output_item, maid.location) !== undefined){
            // 清除女仆
            EntityMaid.Pick.set(maid, false);// 避免捡完东西被消除
            maid.triggerEvent("despawn");
        }
    }
    /**
     * 女仆被魂符收回事件
     * @param {DataDrivenEntityTriggerBeforeEvent} event 
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
        let new_itme = new ItemStack("touhou_little_maid:smart_slab_has_maid", 1)
        new_itme.setLore(lore);
        Tool.setPlayerMainHand(owner, new_itme);
    }
    /**
     * 女仆寄事件
     * @param {DataDrivenEntityTriggerBeforeEvent} event 
     */
    static onDeathEvent(event){
        let maid = event.entity;
        if(maid===undefined) return;

        let backpack = EntityMaid.Backpack.getEntity(maid);
        let lore = EntityMaid.toLore(maid);
        let output_item = new ItemStack("touhou_little_maid:film", 1);
        output_item.setLore(lore);
        
        // 导出胶片物品
        if(config["maid_death_bag"]){
            if(MaidBackpack.getType(backpack) !== MaidBackpack.default){
                let container = MaidBackpack.getContainer(backpack);
                if(container.emptySlotsCount > 0){
                    container.addItem(output_item);
                    return;
                }
            }
        }
        event.entity.dimension.spawnItem(output_item, event.entity.location);
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

        // 拼接lore字符串
        let strLore="";
        for(let temp of lore){ strLore += temp; }
        let strPure = Tool.loreStr2Pure(strLore);

        // 使用者不是主人
        if(StrMaid.Owner.getId(strPure) !== event.source.id) return;
        
        // 放置
        let maid = EntityMaid.fromStr(strPure, dimension, location, true);
        maid.triggerEvent("api:reborn");
        
        // 消耗照片
        Tool.setPlayerMainHand(event.source);
        
        // 如果最近的玩家是主人，直接设置主人
        let closestPlayer = dimension.getPlayers({"closest":1, "location": location})[0];
        if(closestPlayer.id === player.id){
            maid.getComponent("tameable").tame();
        }
        // 否则给予玩家一个苹果，自己驯服
        else{
            let apple = new ItemStack("minecraft:apple", 1);
            apple.nameTag="§cApple!"
            event.source.dimension.spawnItem(apple, event.source.location);
        }
    }
    /**
     * 魂符使用事件
     * @param {ItemUseOnBeforeEvent} event 
     */
    static smartSlabOnUseEvent(event){
        let item = event.itemStack;
        let lore = item.getLore();
        
        // 检测放置位置是否有两格空间
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
        if(lore.length === 0){
            // 首次使用
            maid = EntityMaid.spawnRandomMaid(dimension, location);
            try{
                EntityMaid.Skin.setRandom(maid);
                EntityMaid.Owner.set(maid, player);
                maid.triggerEvent("api:reborn");
            }
            catch{}
        }
        else{
            try{
                // 拼接lore字符串
                let str="";
                for(let temp of lore){ str += temp; }
                str = Tool.loreStr2Pure(str);

                // 使用者不是主人
                if(StrMaid.Owner.getId(str) !== event.source.id) return;

                // 放置
                maid = EntityMaid.fromStr(str, dimension, location, true);
                maid.triggerEvent("api:reborn");
                maid.getComponent("tameable").tame()
            }
            catch{}
        }
        // 没有成功召唤 直接退出
        if(maid === undefined){ return; }
        // 转换物品
        Tool.setPlayerMainHand(event.source, new ItemStack("touhou_little_maid:smart_slab_empty", 1));
        
        // 如果最近的玩家是主人，直接设置主人
        let closestPlayer = dimension.getPlayers({"closest":1, "location": location})[0];
        if(closestPlayer.id === player.id){
            maid.getComponent("tameable").tame();
        }
        // 否则给予玩家一个苹果，自己驯服
        else{
            let apple = new ItemStack("minecraft:apple", 1);
            apple.nameTag="§cApple!"
            event.source.dimension.spawnItem(apple, event.source.location);
        }
    }
    /**
     * 女仆驯服寻主事件
     * 因为 1.没有实体交互事件 2.实体触发器事件没有发动者 3.脚本无法获取主人 4.若与实体交互成功，则物品使用事件不会触发
     * 所以 让女仆自行紧跟主人并扫描，直到脚本获取到主人
     * 对于曾经有主人的女仆，当跟随到的主人与记录不符时会重新回到重生时的野生状态
     * @param {DataDrivenEntityTriggerBeforeEvent} event
     */
    static onTameFollowSuccess(event){
        const results = event.entity.dimension.getPlayers({
            maxDistance:2,
            location:event.entity.location
        })
        if(results.length === 1){
            let maid = event.entity;
            let player = results[0];
            // 寻主成功
            if(EntityMaid.Owner.getID(maid)===undefined || EntityMaid.Owner.getID(maid)===results[0].id){
                // 设置背包主人 因为有可能还没召唤出来，尝试多次直到背包生成
                let backpack = EntityMaid.Backpack.getEntity(event.entity);
                if(backpack===undefined) return;

                backpack.getComponent("tameable").tame();
                // 添加组件
                maid.triggerEvent("api:follow_on_tame_over");
                EntityMaid.Level.eventTamed(maid);

                // 设置主人
                EntityMaid.Owner.setID(maid, player.id);
                EntityMaid.Owner.setName(maid, player.name);
                MaidBackpack.setOwnerID(backpack, player.id);
                
                // 设置工作模式
                let work = maid.getDynamicProperty("temp_work");
                if(work !== undefined){
                    EntityMaid.Work.set(maid, work);
                    maid.setDynamicProperty("temp_work")
                }
            }
            // 跟随到的主人与记录不符 回到未驯服状态
            else{
                maid.triggerEvent("api:follow_on_tame_over_backreborn");
                // 返还一个苹果
                let apple = new ItemStack("minecraft:apple", 1);
                apple.nameTag="§cApple!"
                player.dimension.spawnItem(apple, player.location);
            }
        }
    }
    /**
     * 主人与女仆交互事件
     * @param {DataDrivenEntityTriggerBeforeEvent} event
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
     * 回家事件
     * @param {DataDrivenEntityTriggerBeforeEvent} event
     */
    static returnHomeEvent(event){
        // 比较维度
        let maid = event.entity;
        let homeRadius = EntityMaid.Work.get(maid)===-1 ? 2 : HOME_RADIUS;

        let home_location = EntityMaid.Home.getLocation(maid);
        if(home_location===undefined) return; // 没有家，不回
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
     * 模式切换为坐下，此时主人状态由潜行切换到站立
     * @param {DataDrivenEntityTriggerBeforeEvent} event
     */
    static sitModeEvent(event){
        let maid = event.entity;
        let bag = EntityMaid.Backpack.getEntity(maid);
        EntityMaid.dumpEntityBackpack(maid);// 转储
        // 恢复先前的拾物模式
        if(maid.getDynamicProperty("temp_pick")){
            // 因为此时必定是关闭状态，所以只有先前为开时需要设置
            EntityMaid.Pick.set(maid, true);
        }
        EntityMaid.Emote.set(maid, 0);
        MaidBackpack.hide(bag);
    }
    /**
     * 模式切换为背包操作，此时主人状态由站立切换到潜行
     * @param {DataDrivenEntityTriggerBeforeEvent} event
     */
    static inventoryModeEvent(event){
        let maid = event.entity;
        let bag = EntityMaid.Backpack.getEntity(maid);

        let pick = EntityMaid.Pick.get(maid);
        maid.setDynamicProperty("temp_pick", pick);
        if(pick) EntityMaid.Pick.set(maid, false);

        EntityMaid.dumpMaidBackpack(maid);// 转储 女仆→背包实体
        EntityMaid.Emote.backpack(maid);
        // bag.nameTag = maid.nameTag===""?"entity.touhou_little_maid:maid.name":maid.nameTag;
        MaidBackpack.show(bag);
    }
    /**
     * 定时事件
     * @param {DataDrivenEntityTriggerBeforeEvent} event 
     */
    static timerEvent(event){
        const STEP_MAX = 1000;
        let maid = event.entity; 
        if(maid===undefined) return;
        try{
            // 步数计算 一步3秒
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

            // 取模决定执行任务
            // 3步一回血
            if(healStep % 3 === 0){
                let healthComponent = EntityMaid.Health.getComponent(maid);
                if(healthComponent.currentValue < healthComponent.defaultValue){
                    // 回血
                    let healAmount = EntityMaid.Level.getProperty(maid, "heal");
                    healthComponent.setCurrentValue(
                        Math.min(healthComponent.defaultValue,
                        healthComponent.currentValue + Tool.getRandomInteger(healAmount[0], healAmount[1])));
                }
            }
            
        }
        catch{ }
        
    }
    /**
     * 开盒，生成一只随机女仆
     * @param {DataDrivenEntityTriggerBeforeEvent} event
     */
    static boxOpenEvent(event){
        let box = event.entity;
        EntityMaid.spawnRandomMaid(box.dimension, box.location);
        EntityMaid.playSound(box, "thlm.box");
        box.triggerEvent("despawn");
    }
    /**
     * 坟墓受击
     * @param {DataDrivenEntityTriggerBeforeEvent} event
     */
    static graveAttackEvent(event){
        let backpack = event.entity;
        let backpackL = backpack.location;
        let owenerID = MaidBackpack.getOwnerID(backpack);
        if(owenerID !== undefined){
            // 当主人在附近时，在主人位置开包
            let owner = world.getEntity(owenerID);
            if(owner !== undefined){
                if(Tool.pointInArea_2D(owner.location.x, owner.location.z,
                    backpackL.x - 5, backpackL.z - 5, backpackL.x + 5, backpackL.z + 5)){
                        MaidBackpack.dump(backpack, owner.location);
                }
            }
        }
        else{
            // 没有主人id，所有人都可以开包
            MaidBackpack.dump(backpack, backpack.location);
        }
    }
    /**
     * 背包种类切换
     * @param {DataDrivenEntityTriggerBeforeEvent} event
     * @param {number} typeNew 1, 2, 3 
     */
    static backpackTypeChangeEvent(event, typeNew){
        let backpack = event.entity;
        let typeOld = MaidBackpack.getType(backpack);
        let dimension = backpack.dimension;
        let location = backpack.location;

        if(typeOld > typeNew){
            // 将多余的物品丢出
            let container = MaidBackpack.getContainer(backpack);
            for(let i = MaidBackpack.capacityList[typeNew]; i < MaidBackpack.capacityList[typeOld]; i++){
                let item = container.getItem(i);
                if(item !== undefined){
                    dimension.spawnItem(item, location);
                    container.setItem(i);
                }
            }
        }
        // 升级
        MaidBackpack.setType(backpack, typeNew);
        system.runTimeout(()=>{EntityMaid.Emote.backpack(MaidBackpack.getMaid(backpack));},1)
        
        // 返还旧背包
        if(typeOld !== MaidBackpack.default){
            dimension.spawnItem(new ItemStack(MaidBackpack.type2ItemName(typeOld), 1), location);
        }
    }
    /**
     * 弹幕攻击
     * @param {DataDrivenEntityTriggerBeforeEvent} event 
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
                    target.location.z - location.z)
                let centerDamage = basicDamage*(config["maid_damage"]/100);
                cherryShoot(maid, location, direction, centerDamage, centerDamage/3, 1);
                return;
            }

            // 默认攻击方式
            let distance = Vec.length([
                maid.location.x - maid.target.location.x,
                maid.location.y - maid.target.location.y,
                maid.location.z - maid.target.location.z,
            ]);
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
                        let shoot = DanmakuShoot.create().setWorld(maid.dimension).setThrower(maid).setThrowerOffSet([0,1,0]).setTargetOffSet([0,yOffset,0])
                        .setOwnerID(EntityMaid.Owner.getID(maid))
                        .setRandomColor().setRandomType()
                        .setDamage((distanceFactor + basicDamage + 0.5)*(config["maid_damage"]/100)*delta/amount).setGravity(0)
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
                        .setThrower(maid).setTarget(maid.target).setThrowerOffSet([0,1,0]).setTargetOffSet([0,yOffset,0])
                        .setColor(DanmakuColor.RANDOM).setType(DanmakuType.STAR)
                        .setDamage((distanceFactor + basicDamage + 0.5)*(config["maid_damage"]/100)*delta/18).setGravity(0).setLifeTime(40)
                        .setVelocity(0.5 * (distanceFactor + 1)).setInaccuracy(Math.PI/7);
                        
                        var aimDanmakuShoot_big =DanmakuShoot.create().setWorld(maid.dimension)
                        .setThrower(maid).setThrowerOffSet([0,1,0]).setTargetOffSet([0,yOffset,0]).setLifeTime(45)
                        .setColor(DanmakuColor.RANDOM).setType(DanmakuType.BIG_STAR)
                        .setDamage((distanceFactor + basicDamage + 0.5)*(config["maid_damage"]/100)*delta/10).setGravity(0)
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
                let shoot = DanmakuShoot.create().setWorld(maid.dimension).setThrower(maid).setThrowerOffSet([0,1,0]).setTargetOffSet([0,yOffset,0])
                    .setOwnerID(EntityMaid.Owner.getID(maid))
                    .setDamage((distanceFactor + basicDamage)*(config["maid_damage"]/100)/amount).setGravity(0)
                    .setVelocity(0.5 * (distanceFactor + 1))
                    .setInaccuracy(0.05);
                
                for(let i = 0; i < amount; i++){
                    system.runTimeout(()=>{
                        shoot.setTarget(maid.target).setRandomColor().setRandomType().aimedShot();
                    }, i*12);
                }
            }
        }
    }
    /**
     * 等级设置
     * @param {DataDrivenEntityTriggerBeforeEvent} event 
     */
    static setLevelEvent(event){
        let maid = event.entity;
        if(maid===undefined) return;

        let level = parseInt(event.id.substring(7));
        EntityMaid.Level.set(maid, level);
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
     * 女仆成为 NPC
     * @param {DataDrivenEntityTriggerBeforeEvent} event 
     */
    static onNPCEvent(event){
        let maid = event.entity;
        if(maid===undefined) return;

        EntityMaid.Home.setLocation(maid);
        EntityMaid.Backpack.getEntity(maid).kill();
    }
    /**
     * NPC 交互
     * @param {DataDrivenEntityTriggerBeforeEvent} event 
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

