///// 配置 /////
const FontRoot = 0xE600; // 物品字符头
const CraftingTable = String.fromCodePoint(0xE500); // 合成台字符
const Altar = String.fromCodePoint(0xE501); // 祭坛字符
const VoidItem = 0; // 物品占位字符
const Arrow = String.fromCodePoint(FontRoot + 2) 
/**
 * 模板
 * %n：材料
 * a：箭头
 * g：棋盘
 * $：产品
 * $n：产品数量（仅一位数）
 * %p：消耗p点
 */
// 合成台字符串
//                                                                    1       
//1 2 3                                4 5 6   r                               c     7 8 9
const TemplateCraftingTable = "   %1 %2 %3                " + CraftingTable 
    + "               %4 %5 %6 " + Arrow
    + " $                               $n     %7 %8 %9";
// 祭坛字符串：                                                                                1               §cP:5.00
const TemplateAltar = "      %3%4                    " + Altar
    + "               %2      %5 " + Arrow
    + " $                               $n     %1      %6    §c%p";

// 物品-字体序号映射表
var itemFont = {
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
    "minecraft:dirt": 0x3B
};

///// 处理 /////
function generate(){
    // 解析合成表
    var recipeInfo = {};
    recipeInfo["list"] = [
        document.getElementById("recipe1").value,
        document.getElementById("recipe2").value,
        document.getElementById("recipe3").value,
        document.getElementById("recipe4").value,
        document.getElementById("recipe5").value,
        document.getElementById("recipe6").value,
    ];
    recipeInfo["output"] = document.getElementById("output").value;
    recipeInfo["output_c"] = document.getElementById("output_c").value;
    recipeInfo["p"] = document.getElementById("power").value;
    if(recipeInfo["p"] === '1') recipeInfo["p"] = ' '

    // 生成字符串
    var title  = document.getElementById("title").value;
    var info   = document.getElementById("info").value;
    var c = document.getElementById("chapter").value; // chapter
    var p = document.getElementById("page").value; // page

    var book = {"rawtext":[
        {"text":"\n"},{"translate":`me.c${c}.p${p}.ti`},{"text":"\n"},// 标题
        {"translate":`me.c${c}.p${p}.t1`},{"text":"\n\n\n"},// 说明
        {"translate":`me.c${c}.p${p}.t2`}]};// 合成表
    var lang = {};
    
    lang[`me.c${c}.p${p}.ti`] = `§l${title}§r`;
    lang[`me.c${c}.p${p}.t1`] = `   ${info}`;
    
    var recipeStr = TemplateAltar;
        
    // 产物
    let count = recipeInfo["output_c"]===1?' ':`${recipeInfo["output_c"]}`;
    recipeStr = recipeStr.replace("$n", count);
    let cid = itemFont[recipeInfo["output"]];
    recipeStr = recipeStr.replace("$", String.fromCodePoint(FontRoot+cid));

    // 材料
    for(let i = 0; i<6; i++){
        let id = VoidItem;
        if(recipeInfo["list"][i]!=undefined){
            id = itemFont[recipeInfo["list"][i]];
        }
        recipeStr = recipeStr.replace(`%${i+1}`, String.fromCodePoint(FontRoot+id));
    }
    // P点
    recipeStr = recipeStr.replace("%p", `P:${recipeInfo["p"]}`);
    
    lang[`me.c${c}.p${p}.t2`] = recipeStr;
    
    // 输出
    let bookStr = JSON.stringify(book, null, '');
    document.getElementById("booktext").value = bookStr;
    
    let langStr = `## ${title} ##\n## ${bookStr}\n`;
    for(let langKey in lang){
        langStr += `${langKey}=${lang[langKey]}\n`
    }
    document.getElementById("langtext").value = langStr
}

function generate_table(){
    // 解析合成表
    let recipeInfo = {list:[], output:""}

    recipeInfo["list"] = [
        document.getElementById("recipe1_1").value,
        document.getElementById("recipe1_2").value,
        document.getElementById("recipe1_3").value,

        document.getElementById("recipe2_1").value,
        document.getElementById("recipe2_2").value,
        document.getElementById("recipe2_3").value,

        document.getElementById("recipe3_1").value,
        document.getElementById("recipe3_2").value,
        document.getElementById("recipe3_3").value
    ];
    recipeInfo["output"] = document.getElementById("output").value
    recipeInfo["output_c"] = document.getElementById("output_c").value

    // 生成字符串
    var title  = document.getElementById("title").value;
    var info   = document.getElementById("info").value;
    var c = document.getElementById("chapter").value; // chapter
    var p = document.getElementById("page").value; // page

    var book = {"rawtext":[
        {"text":"\n"},{"translate":`me.c${c}.p${p}.ti`},{"text":"\n"},// 标题
        {"translate":`me.c${c}.p${p}.t1`},{"text":"\n\n\n"},// 说明
        {"translate":`me.c${c}.p${p}.t2`}]};// 合成表
    var lang = {};

    lang[`me.c${c}.p${p}.ti`] = `§l${title}§r`;
    lang[`me.c${c}.p${p}.t1`] = `   ${info}`;

    
    var recipeStr = TemplateCraftingTable;
        
    // 产物
    let count = recipeInfo["output_c"]==="1"?' ':`${recipeInfo["output_c"]}`;
    recipeStr = recipeStr.replace("$n", count);
    let cid = itemFont[recipeInfo["output"]];
    recipeStr = recipeStr.replace("$", String.fromCodePoint(FontRoot+cid));

    // 材料
    for(let i = 0; i<9; i++){
        let id = VoidItem;
        if(recipeInfo["list"][i]!="air"){
            id = itemFont[recipeInfo["list"][i]];
        }
        recipeStr = recipeStr.replace(`%${i+1}`, String.fromCodePoint(FontRoot+id));
    }
    
    
    lang[`me.c${c}.p${p}.t2`] = recipeStr;

    // 输出
    let bookStr = JSON.stringify(book, null, '');
    document.getElementById("booktext").value = bookStr;
    
    let langStr = `## ${title} ##\n## ${bookStr}\n`;
    for(let langKey in lang){
        langStr += `${langKey}=${lang[langKey]}\n`
    }
    document.getElementById("langtext").value = langStr
}