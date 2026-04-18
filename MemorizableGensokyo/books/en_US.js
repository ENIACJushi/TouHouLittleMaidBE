import {recipeList} from "../../TouHouLittleMaid_BP/scripts/data/recipes/index.js"

export const book1 = [
// 前言
{ type: "text", content: 
`         §lOverview§r
           §7(1/3)§r
  A mod about the maid and the touhou project. 
  Thanks 7z for making the UI. 
  Thanks EndersTister for fixing the bug.`
},
{ type: "text", content:
`

  Thanks to people like Tartrate and Snownee for making TLM java mod. 
  Thanks to the artists for producing excellent models. 
  Thanks to Verclene, the author of LMM mod.`
},
// 目录
{ type: "text", content:
`        §lCatalogue§r

Touhou Project..............1
Fairy Maid.............................2
Power Point.........................3
Gohei & Danmaku..............5
Altar..........................................7`
},
{type: "text", content:
`§lTouhou Project§r
  The Touhou Project is a Japanese doujin game series by Sole Team Shanghai Alice member ZUN that specializes in Shoot 'em Ups.

  Touhou Wiki: https://en.touhouwiki.net/wiki/Touhou_Wiki`
// 单图 图片位置用 $image$ 表示
},
{ type: "img", img: 0x10, content:
`§lFairy Maid§r
  The looting of this mob are important crafting ingredient.
       $image$
  Spawn on the night and attack the player with danmaku.`
},
{ type: "img", img: 0x12, content:
`§lPower Point§r
  The power point is an important resource for this mod, which is obtained by killing the maid fairy Can be used for altar crafting.
       $image$`
},
{ type: "text", content:
`
   You can also find some in the chest of the desert temple.

   When you holds gohei, you can see the power value above the inventory. The maximum power value is 5, and more than this number power point no longer increases.`
},
// 工作台合成 自动区分有序/无序，但物品贴图要手动添加 $recipe$是合成表插入的位置
{type: "craft", recipe: "hakurei_gohei.json", content:
`§lGohei and Danmaku§r
   The gohei is a long-range weapon that shoots a barrage.

$recipe$
`
},
{ type: "text", content:
`
   When you interact with any block in sneaking mode, you can switch types.

   Due to technical limitations, the gohei made by the composite table need to be used by the other block before they can be activated.`
},
{ type: "img", img: 0x11, content:
`§lAltar§r
   The altar is the multi-block structure required for the craft of this mod. The craft also requires player's power point.
       $image$`
},
{ type: "img", img: 0x13, content:
`
   Use the gohei to right click on the red wool front left of center of the fourth layer to build an altar.

       $image$`
},
{ type: "text", content:
`  You can right click on the top of each of the six pillars to place items. Jump under the pole and pick it up. When the item is fully placed and the Power value is sufficient, the altar can trigger crafting.
  When crafting is interrupted due to lack of Power, replacing any material after obtaining enough Power can `
},
{ type: "text", content:
`trigger crafting.
  There is no need to worry about forgetting to remove the material, the items on the altar will not automatically disappear.`
}

]

////// 第二章 //////
export const book2 = [
{ type: "text", content: 
`
            §lMaid§r
            §7(2/3)§r
  Introduced the basic functions of the maid.`
},
// 目录
{ type: "text", content:
`
        §lCatalogue§r

Spawn Maid.............................1
Reborn Maid..........................4
Upgrade Maid.......................5
Camera & Photo.................6
Chisel & Statues...............8
Backpack...............................11
Princess Hug....................14`
},
// patchouli.touhou_little_maid:book.entries.maid.spawn_maid.name.name
{ type: "altar", recipe: recipeList.spawn_box, content:
`§lSpawn Maid§r
  The way to get a maid is very special and needs to be done through a multi-blocks altar.

$recipe$`
},
{type: "text",  content:
`
  After the maid is successfully spawned in a multi-blocks altar, you will get a cake box wrapped with the maid, just right-click the cake box to open it. You will need a cake to tame the maid.
  In the standing state, the master can switch between standby modes. A maid in standby mode`
},
{type: "text",  content:
`does nothing, not even to avoid risk.
  In the sneaking state, an attack can open the information panel and interactive can open the backpack interface.`
},
// patchouli.touhou_little_maid:book.entries.maid.film.pages.0.text.name
{ type: "altar", recipe: recipeList.reborn_maid, content:
`§lReborn Maid§r
  The maid will drop a film after death, and the film can be used in altar to reborn the maid.

$recipe$`
},
{ type: "altar", recipe: recipeList.maid_upgrade, content:
`§lUpgrade Maid§r
  Place maids who have reached 200 kills in the center of the altar and level up with Sakura Gohei and Magic Powder.


$recipe$`
},
{ type: "altar", recipe: recipeList.craft_camera, content:
`§lCamera & Photo§r
   Carry a maid across dimensions or at a distance is a hassle, and the camera is designed for this purpose. 

$recipe$`
},
{ type: "text", content:
`
  Just take a photo of your maid with camera and turn it into a photo, then hold the photo and right click on a block to release it.
`
},
// patchouli.touhou_little_maid:book.entries.other.chisel_and_statues.name.name
{ type: "altar", recipe: recipeList.craft_chisel, content:
`§lChisel & Statues§r
   Right-click the clay with a chisel can make statues of different sizes. Currently supports 1x1x1, 1x1x2, 2x2x4, 3x3x6 sizes.

$recipe$`
},
{ type: "text",  content:
`
  Holds a photo in offhand, chisel in mainhand, then right-clicks the lower left corner of the multi-block structure to engrave the maid in the photo.
  The fire roasted 1x1 size statue can be converted into Garage Kit.`
},
{ type: "img", img: 0x14,  content:
`
$image$`
},
{ type: "altar", recipe: recipeList.craft_maid_backpack_small,  content:
`§lBackpack§r
  The backpack can be used to expand the inventory of the maid. It can be applied by holding the backpack, sneaking, and right-click on the maid.
  Use the shears to remove the maid's backpack.`
},
{ type: "double_module", module1: {type: "altar", recipe: recipeList.craft_maid_backpack_small}, 
module2: {type: "altar", recipe: recipeList.craft_maid_backpack_middle}, content:
`$module1$
$module2$`
},
{ type: "altar", recipe: recipeList.craft_maid_backpack_big, content:
`
$recipe$`
},
{ type: "img", img: 0x15,  content:
`§lPrincess Hug§r
   Hold the saddle, interact with the maid, you can pick her up, interact again, you can put her down.
$image$
`
}
]


////// 第三章 //////
export const book3 = [
{ type: "text", content:
`
           §lOthers§r
            §7(3/3)§r
  Introduce some miscellaneous content.
`
},
{ type: "text", content:
`
        §lCatalogue§r

Memorizable Gensokyo..1
Gohei............................................2
Lighting......................................3
Gold Microwave Oven.....4`
},
{ type: "craft", recipe: "memorizable_gensokyo.json", content:
`§lMemorizable Gensokyo§r
   Book, cake.


$recipe$`
},
{ type: "altar", recipe: recipeList.craft_hakurei_gohei, content:
`§lGohei (Crafting)§r
   Gohei can be made at the altar at a much lower cost.


   $recipe$`
},
{ type: "altar", recipe: recipeList.repair_hakurei_gohei, content:
`§lGohei (repairing)§r
   Gohei cannot be repaired by mending, but here's a better way without repair punishment.

$recipe$`
},
{ type: "altar", recipe: recipeList.gohei_cherry, content:
`§lSakura gohei§r
   Gohei, sakura saplings, buckets, dirt.



$recipe$`
},
{ type: "altar", recipe: recipeList.spawn_lightning_bolt, content:
`§lLighting§r
    Summon a lightning bolt.


$recipe$`
},
{ type: "craft", recipe: "gold_microwaver.json", content:
`§lGold microwave oven§r
   Bell, blaze powder, yellow glass, gold ingot, Ender crystal.


$recipe$`
},
{ type: "craft", recipe: "dragon_skull.json", content:
`§lDragon skull§r
   Lapis lazis, lightning rod, amethyst, dragon skull, chorus flower.

$recipe$`
}
]
