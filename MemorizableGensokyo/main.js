///// 配置 /////
const FontRoot = 0xE600; // 物品字符头
const CraftingTable = String.fromCodePoint(0xE500); // 合成台字符
const Altar = String.fromCodePoint(0xE501); // 祭坛字符
const VoidItem = 0; // 物品占位字符
/**
 * 模板
 * %n：材料
 * a：箭头
 * g：棋盘
 * $：产品
 * $n：产品数量（仅一位数）
 * %p：消耗p点
 */
// 合成台字符串：    %1 %2 %3                g      %4          %5 %6 a $                                     %7 %8 %9
const TemplateCraftingTable = "   %1 %2 %3                " + CraftingTable 
    + "      %4          %5 %6 " + String.fromCodePoint(FontRoot + 2) 
    + " $                               $n     %7 %8 %9";
// 祭坛字符串：                                                                                1               §cP:5.00
const TemplateAltar = "      %3%4                    " + Altar
    + "               %2      %5 " + String.fromCodePoint(FontRoot + 2)
    + " $                               $n     %1      %6    §c%p";

// 物品-字体序号映射表
var itemFont = {
    // 工作台御币
    "minecraft:diamond": 0x10,
    "minecraft:stick": 0x11,
    "forge:rods/wooden": 0x11,
    "minecraft:paper": 0x12,
    "thlm:gohei": 0x13,
    "touhou_little_maid:hakurei_gohei_pellet": 0x13,
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
    "touhou_little_maid:box":0x2C
};

///// 处理 /////
function generate(){
    var errorLog = document.getElementById("error_log").value;
    // 解析合成表
    var recipeStr = document.getElementById("recipe").value;
    recipeStr = recipeStr.replace("export const recipe = ", "");
    var recipe = JSON.parse(recipeStr);
    var recipeInfo = {};
    if(recipe["type"] != undefined 
        && recipe["type"] === "touhou_little_maid:altar_crafting")
    {
        // 祭坛合成，收集所需物品信息
        recipeInfo["type"] = "altar";
        recipeInfo["list"] = [];
        recipeInfo["output"] = recipe["output"]["nbt"]["Item"]["id"];
        recipeInfo["output_c"] = recipe["output"]["nbt"]["Item"]["Count"];
        recipeInfo["p"] = recipe["power"]
        for(let input of recipe["ingredients"]){
            // tag 或 item
            let id = input["item"]===undefined ? input["tag"]:input["item"];
            recipeInfo["list"].push(id);
            if(itemFont[id] === undefined){
                errorLog.innerHTML += `错误：未指定的图标 ${id}\n`;
                return;
            }
        }
    }
    else{
        // 工作台合成
        recipeInfo["type"] = "table";

    }

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
    
    if(recipeInfo["type"] === "altar"){
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
        recipeStr = recipeStr.replace("%p", `P:${recipeInfo["p"].toFixed(2)}`);
        
        lang[`me.c${c}.p${p}.t2`] = recipeStr;
    }

    // 输出
    document.getElementById("booktext").value = JSON.stringify(book, null, '');
    let langStr = "";
    for(let langKey in lang){
        langStr += `${langKey}=${lang[langKey]}\n`
    }
    document.getElementById("langtext").value = langStr
}