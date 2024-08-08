import {recipeList} from "../../TouHouLittleMaid_BP/scripts/data/recipes/index.js"

export const book1 = [
// 前言
{ type: "text", content: 
`
            §l总览§r
            §7(1/3)§r
  一个与女仆和东方 Project 有关的模组。 
  感谢7z制作的UI。感谢酒石酸菌和雪尼等人制作的java版TouhouLittleMaid。 
  感谢酒石酸菌、琥珀酸、帕金伊、天顶乌、天幂、Paulzzh、尤里的猫以及其他美工制作了如此优秀的模型和材质。
  感谢 Little Maid Mob 的作者 Verclene。`
},
// 目录
{ type: "text", content:
`
             §l目录§r

东方 Project.................................3
女仆妖精........................................4
Power道具......................................5
御币与弹幕....................................7
多方块祭坛....................................9`
},
{type: "text", content:
`
§l东方Project§r
  东方 Project 是日本同人社团上海爱丽丝幻乐团制作的一系列同人作品，系列以清版弹幕射击游戏为主。

  Touhou 百科： https://en.touhouwiki.net/wiki/Touhou_Wiki`

// 单图 图片位置用 $image$ 表示
},
{ type: "img", img: 0x10, content:
`
§l女仆妖精§r
  这个模组添加了一种怪物，怪物的掉落物是重要的合成材料。
       $image$
  在任意群系的夜晚生成，会以弹幕攻击玩家。`

},
{ type: "img", img: 0x12, content:
`
§lPower 道具§r
  Power道具是本模组重要的资 源， 通过杀死女仆妖精来获取。 能够用于祭坛合成。
       $image$`

},{ type: "text", content:
`

  也可以在沙漠神殿的箱子里找 到得点道具， 砸在地上可以爆出大 量P点。

  当你手持御币时， 在物品栏上 方就能看到Power值。 Power值最 大为5, 超过此数值不再增长。`

// 工作台合成 自动区分有序/无序，但物品贴图要手动添加 $recipe$是合成表插入的位置
},{type: "craft", recipe: "hakurei_gohei.json", content:
`
§l御币与弹幕§r
  御币是一个普通的远程武器。可以射出弹幕。

$recipe$
`

},{ type: "text", content:
`

  潜行状态下与任意方块交互，
即可切换弹种。同时会收到当前弹
种的提示。

  因技术限制， 由合成台制作的御
币需要先对方块使用一下才能激
活。`
},{ type: "img", img: 0x11, content:
`
§l多方块祭坛§r
  祭坛是本模组用于合成所必需的多方块结构，合成同时还需要玩家的power值。
       $image$`

},{ type: "img", img: 0x13, content:
`

   使用御币右击第四层中间偏左的红色羊毛正面，能够构建祭坛。

       $image$`

},{ type: "text", content:
`
  你可以右击六个柱子的顶端来放置物品。在柱子下跳起捡回。当物品完全放置且Power值足够，祭坛就能触发合成。

  因为缺少Power而导致的合成中断，获取足够Power后重新放置任意材料可以触发合成。

  无需担心忘记取下材料，祭坛上的物品是不会自动消失的。`
},
{ type: "placeholder"},
{ type: "placeholder"},
{ type: "placeholder"},
{ type: "placeholder"},
{ type: "placeholder"}
]


////// 第二章 //////
export const book2 = [
{ type: "text", content: 
`
            §l女仆§r
            §7(2/3)§r
  介绍女仆的基本内容。`
},
// 目录
{ type: "text", content:
`
             §l目录§r

生成女仆........................................3
复活女仆........................................5
升级女仆........................................6
相机与照片....................................7
凿子................................................9
女仆背包.......................................11
公主抱..........................................13`
},
// patchouli.touhou_little_maid:book.entries.maid.spawn_maid.name.name
{ type: "altar", recipe: recipeList.spawn_box, content:
`
§l生成女仆§r
  获取女仆的方式非常特殊，而且必须通过多方块祭坛。

$recipe$`
},
{type: "text",  content:
`
  成功生成女仆后，会得到一个包装着女仆的蛋糕盒。

  右击蛋糕盒即可将女仆释放出来，你需要一块蛋糕才能驯服她。

  主人在站立状态下交互能够切换待命模式。待命模式下的女仆什么也不会做，哪怕是规避风险。
  在潜行状态下攻击即可打开信息面板，交互则是打开背包界面。
`
},
// patchouli.touhou_little_maid:book.entries.maid.film.pages.0.text.name
{ type: "altar", recipe: recipeList.reborn_maid, content:
`
§l复活女仆§r
  女仆会在阵亡后掉落胶片，胶片可在祭坛中合成来复活女仆。


$recipe$`
},

// patchouli.touhou_little_maid:book.entries.maid.film.pages.0.text.name
{ type: "altar", recipe: recipeList.maid_upgrade, content:
`
§l升级女仆§r
  将击杀数到达200的女仆放在祭坛中央，放上樱之御币和神秘尘即可升级。

$recipe$`
},
{ type: "altar", recipe: recipeList.craft_camera, content:
`
§l相机与照片§r
   跨维度或远距离携带女仆是一件麻烦的事情，相机应运而生。


$recipe$
`
},
{ type: "text", content:
`

  用相机对着自己的女仆拍摄就能将其变成照片，之后拿着照片对方块右击，又可以将其释放出来。
`
},
// patchouli.touhou_little_maid:book.entries.other.chisel_and_statues.name.name
{ type: "altar", recipe: recipeList.craft_chisel, content:
`
§l凿子§r
   凿子右击粘土可以做成不同尺寸的雕像，目前支持 1x1x1 1x1x2 2x2x4 3x3x6。

$recipe$`
},
{ type: "img", img: 0x14,  content:
`
  副手持照片，主手持凿子，右击多方块结构的左下角，即可雕刻出照片中的女仆。
$image$
  火烤1x1大小的雕像可以转换成手办。`
},
{ type: "altar", recipe: recipeList.craft_maid_backpack_small,  content:
`
§l女仆背包§r
  背包能够拓展女仆的物品栏。只需要在潜行双胎下手持背包右击女仆，即可装备上对应的背包。
  使用剪刀来移除女仆的背包。

$recipe$`
},
{ type: "double_module", module1: {type: "altar", recipe: recipeList.craft_maid_backpack_middle}, 
module2: {type: "altar", recipe: recipeList.craft_maid_backpack_big}, content:
`$module1$
$module2$`
},
{ type: "img", img: 0x15,  content:
`
§l公主抱§r
   手持鞍和女仆交互即可抱起，再次交互即可放下。

$image$
`
},
{ type: "placeholder"},
{ type: "placeholder"},
{ type: "placeholder"},
{ type: "placeholder"},
{ type: "placeholder"},
{ type: "placeholder"},
{ type: "placeholder"}
]

////// 第三章 //////
export const book3 = [
{ type: "text", content:
`
             §l杂项§r
             §7(3/3)§r
  介绍一些其它内容。
`
},
{ type: "text", content:
`
             §l目录§r

记忆中的幻想乡.............................3
御币................................................4
落雷................................................7
黄金微波炉...................................8`
},
{ type: "craft", recipe: "memorizable_gensokyo.json", content:
`
§l《记忆中的幻想乡》§r
   书、蛋糕。


$recipe$`
},
{ type: "altar", recipe: recipeList.craft_hakurei_gohei, content:
`
§l御币 (合成)§r
   御币可以在祭坛以更低的代价合成。


   $recipe$`
},
{ type: "altar", recipe: recipeList.repair_hakurei_gohei, content:
`
§l御币 (修复)§r
   御币无法被附魔经验修补，但可以消耗P点和纸回满耐久，这种修复没有惩罚。

$recipe$`
},
{ type: "altar", recipe: recipeList.gohei_cherry, content:
`
§l樱之御币§r
   御币、樱花树苗、水桶、泥土。


$recipe$`
},
{ type: "altar", recipe: recipeList.spawn_lightning_bolt, content:
`
§l落雷§r
    召唤一道雷电。


$recipe$`
},
{ type: "craft", recipe: "gold_microwaver.json", content:
`
§l黄金微波炉§r
   钟、烈焰粉、黄色玻璃、金锭、末影水晶。


$recipe$`
},
{ type: "craft", recipe: "dragon_skull.json", content:
`
§l龙头§r
   青金石、雷霆之杖、紫水晶、龙首、紫颂花。放在黄金微波炉加热获得神秘尘。

$recipe$`
},
{ type: "placeholder"},
{ type: "placeholder"},
{ type: "placeholder"},
{ type: "placeholder"},
{ type: "placeholder"}
]
