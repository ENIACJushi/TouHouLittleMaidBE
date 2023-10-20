import { Entity, system } from "@minecraft/server";
import { EntityMaid } from "./EntityMaid";

export class WorkType{
    static AMOUNT         = 14;  // 总数

    static idle           = 0;  // 空闲
    static attack         = 1;  // 攻击

    static ranged_attack  = 2;  // 弓兵
    static danmaku_attack = 3;  // 弹幕攻击
    static farm           = 4;  // 农场
    static sugar_cane     = 5;  // 甘蔗
    static melon          = 6;  // 瓜类
    static cocoa          = 7;  // 可可
    static grass          = 8;  // 花草
    static snow           = 9;  // 清雪
    static feed           = 10; // 喂食
    static shears         = 11; // 剪刀
    static milk           = 12; // 牛奶
    static torch          = 13; // 火把
    static feed_animal    = 14; // 繁殖动物
    static extinguishing  = 15; // 灭火

    static NAME_LIST=[
        "idle",
        "attack",

        "ranged_attack",
        "danmaku_attack", 
        "phantom_killer",
        "farm",
        "sugar_cane",
        "melon",
        "cocoa",          
        "grass",      
        "snow",
        "feed",
        "shears",
        "milk",
        "torch",
        "feed_animal",
        "extinguishing"
    ]

    // 切换到模式时的音效
    static SOUND_LIST=[
        undefined,
        "mob.thlmm.maid.attack",
        "mob.thlmm.maid.attack",
        "mob.thlmm.maid.attack", 
        "mob.thlmm.maid.attack",
        undefined,
        undefined,
        undefined,
        undefined,          
        undefined,      
        undefined,
        "mob.thlmm.maid.feed",
        undefined,
        undefined,
        undefined,
        "mob.thlmm.maid.feed",
        undefined
    ]
    // UI 图标
    static IMG_LIST=[
        "textures/items/feather.png",
        "textures/items/diamond_sword.png",
        "textures/items/bow_standby.png",
        "textures/items/hakurei_gohei.png",
        "textures/items/phantom_membrane.png",
        "textures/items/iron_hoe.png",
        "textures/items/reeds.png",
        "textures/items/melon.png",
        "textures/items/dye_powder_brown.png",
        "textures/blocks/tallgrass.png",
        "textures/items/snowball.png",
        "textures/items/beef_cooked.png",
        "textures/items/shears.png",
        "textures/items/bucket_milk.png",
        "textures/items/torch_on.png",
        "textures/items/wheat.png",
        "textures/items/extinguisher.png"
    ]

    /**
     * 获取工作模式
     * @param {Entity} maid 
     * @returns {WorkType|number}
     */
    static get(maid){
        return maid.getComponent("minecraft:variant").value;
    }
    /**
     * 设置工作模式
     * @param {Entity} maid 
     * @param {WorkType|number} type
     */
    static set(maid, type){
        if(this.get(maid) !== type){
            maid.triggerEvent(`api:mode_quit_${this.getName(this.get(maid))}`);
            
            system.runTimeout(()=>{
                maid.triggerEvent(`api:mode_${this.getName(type)}`);
            }, 1);

            let sound = this.getSound(type);
            if(sound !== undefined){
                EntityMaid.playSound(maid, sound);
            }
        }
    }
    /**
     * 获取名称
     * @param {WorkType|number} type
     * @returns {string}
     */
    static getName(type){
        return this.NAME_LIST[type];
    }
    /**
     * 获取语言文件字符串
     * @param {WorkType|number} type
     * @returns {string}
     */
    static getLang(type){
        return `task.touhou_little_maid:${this.getName(type)}.name`;
    }
    /**
     * 获取按钮材质
     * @param {WorkType|number} type
     * @returns {string}
     */
    static getIMG(type){
        return this.IMG_LIST[type];
    }
    /**
     * 获取声音
     * @param {*} type
     * @returns {string|undefined}
     */
    static getSound(type){
        return this.SOUND_LIST[type];
    }
}