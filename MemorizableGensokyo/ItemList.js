const itemFont = {
    // 空位
    "air": 0x00,
    // 工作台御币
    "minecraft:diamond": 0x10,
    "minecraft:stick": 0x11,
    "forge:rods/wooden": 0x11,
    "minecraft:paper": 0x12,
    "thlm:gohei": 0x13,
    "touhou_little_maid:hakurei_gohei": 0x13,
    // 照相机
    "minecraft:quartz_block": 0x14,
    "minecraft:obsidian": 0x15,
    "touhou_little_maid:camera": 0x16,
    
    // 背包
    "minecraft:gray_wool": 0x17,
    "touhou_little_maid:maid_backpack_big": 0x18,
    
    "minecraft:pink_wool": 0x19,
    "minecraft:gold_ingot": 0x1A,
    "touhou_little_maid:maid_backpack_middle": 0x1B,
    
    "minecraft:red_wool": 0x1C,
    "minecraft:iron_ingot": 0X1D,
    "touhou_little_maid:maid_backpack_small": 0x1E,
    // 复活
    "touhou_little_maid:film": 0x1F,
    "minecraft:lapis_lazuli": 0x20,
    "minecraft:redstone": 0x21,
    "minecraft:coal": 0x22,
    "reborn_maid": 0x23,
    // 落雷
    "forge:gunpowder":0x24,
    "minecraft:blaze_powder":0x25,
    "minecraft:lightning_bolt":0x26,
    // 生成女仆
    "minecraft:lapis_block":0x27,
    "minecraft:gold_block":0x28,
    "minecraft:redstone_block":0x29,
    "minecraft:iron_block":0x2A,
    "minecraft:coal_block":0x2B,
    "touhou_little_maid:box":0x2C,

    // 记忆中的幻想乡
    "minecraft:book": 0x2D,
    "minecraft:cake": 0x2E,
    "touhou_little_maid:memorizable_gensokyo": 0x2F,
    "touhou_little_maid:memorizable_gensokyo_1": 0x2F,

    // 龙头
    "minecraft:amethyst_shard": 0x30,
    "minecraft:chorus_flower": 0x31,
    "minecraft:lightning_rod": 0x32,
    "minecraft:skull:5": 0x33,
    "touhou_little_maid:dragon_skull": 0x34,

    // 黄金微波炉
    "minecraft:bell": 0x35,
    "minecraft:yellow_stained_glass": 0x36,
    "minecraft:end_crystal": 0x37,
    "touhou_little_maid:gold_microwaver_item": 0x38, 

    // 樱之御币
    "minecraft:cherry_sapling": 0x39,
    "minecraft:water_bucket": 0x3A,
    "minecraft:dirt": 0x3B,

    // 升级
    "touhou_little_maid:magic_powder": 0x3C,
    "touhou_little_maid:maid_upgrade": 0x3D,

    // 雕刻刀
    "minecraft:yellow_dye": 0x3E,
    "minecraft:red_dye": 0x3F,
    "touhou_little_maid:chisel": 0x40
};

/**
 * 
 * @param {String} key 
 * @returns {undefined|String}
 */
export function getItemFont(key){
    // 御币
    if(key.substring(0, 32) === "touhou_little_maid:hakurei_gohei" || key === "thlm:gohei_lv1"){
        return itemFont["touhou_little_maid:hakurei_gohei"];
    }
    // 复活
    if(key === "touhou_little_maid:maid"){
        return itemFont["reborn_maid"]
    }
    return itemFont[key];
}