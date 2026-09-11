#### 原作者前言
<span>&#8195;&#8195;</span>一个与女仆和东方 Project 有关的模组。感谢雪尼在代码方面的帮助。感谢琥珀酸、帕金伊、天顶乌、天幂、Paulzzh、尤里的猫以及其他美工制作了如此优秀的模型和材质。感谢 Little Maid Mob 的作者 Verclene。

#### 移植者前言

<span>&#8195;&#8195;</span>嘿，正在看这篇指南的人，恭喜你发现了宝藏！如果你是一名生存玩家或服务器管理者，这个模组或许会成为一个必装Add-On：得益于良好的兼容性与休闲的定位，大多数模组都能与它和谐共生。如果你是一个开发者，也许将会从中学到一些闻所未闻的新技术——这个模组使用脚本制造了多种基础工具，创造了许多新概念！

#### 一、总览

##### 东方Project

东方 Project 是日本同人社团上海爱丽丝幻乐团制作的一系列同人作品，系列以清版弹幕射击游戏为主。

Touhou 百科：https://en.touhouwiki.net/wiki/Touhou_Wiki

##### 女仆妖精
<span>&#8195;</span>这个模组添加了一种怪物。

<span>&#8195;</span>怪物的掉落物是重要的合成材料。

<img style="margin-left:21px" src=Imgs/fairy.png>

<span>&#8195;</span>在任意群系的夜晚生成，会以弹幕攻击玩家。

##### Power 道具

<span>&#8195;</span>Power 道具是本模组重要的资源，通过杀死女仆妖精来获取。能够用于祭坛合成。

<span>&#8195;</span>也可以在沙漠神殿的箱子里找到得点道具，砸在地上可以爆出大量P点。

<span>&#8195;</span>当你手持御币时，在物品栏上方就能看到 power 值。Power 值最大为 5，超过此数值不再增长。

##### 御币与弹幕

<span>&#8195;</span>御币是一个普通的远程武器。可以射出弹幕。

<span>&#8195;</span>潜行状态下与任意方块交互，即可切换弹种。同时会收到当前弹种的提示。

<span>&#8195;</span>因技术限制，由合成台制作的御币需要先对方块使用一下才能激活。

<img style="margin-left:21px" src=Imgs/craft_gohei.png>

<span>&#8195;</span>御币还是构建多方块祭坛的重要工具。

##### 多方块祭坛

<span>&#8195;</span>祭坛是本模组用于合成所必需的多方块结构。祭坛的合成表可以在文查询，合成同时还需要玩家的power值。
<span>&#8195;</span>使用御币右击第四层中间偏左的红色羊毛正面，能够构建祭坛。

<img style="margin-left:21px" src=Imgs/altar.png>

<span>&#8195;</span>你可以右击六个橡木柱子的顶端来放置物品。在柱子下跳起捡回物品。当物品完全放置且玩家的 Power 值足够，祭坛就能触发合成。

因为缺少 Power 而导致的合成中断，在获取足够 Power 以后，重新放置任意材料可以重新触发合成。

<span>&#8195;</span>无需担心忘记取下材料，在祭坛上的物品是不会自动消失的。

**合成表**

目前仅有少量合成表被加入，如有需要，可以使用最后一章介绍的方法添加自定义的合成。
+ 御币
木棍×3 + 纸×3 + P点×0.15

+ 修复御币
御币 + 纸×2 + P点×0.10

+ 召唤雷电
烈焰粉×3 + 火药×3 + P点×0.20


#### 自定义

##### 祭坛合成表

<span>&#8195;</span>祭坛的合成表在行为包的 "scripts/recipes" 目录下定义。要添加一个新的合成表，只需要参照如下说明添加与修改文件：

1. 创建定义文件：在recipe目录下新建一个js文件，建议复制已有的文件，可以避免一些未知的错误。如"craft_hakurei_gohei.js"
2. 定义材料与产物
   材料在"ingredients"对象内指定，包括"tag"与"item"两种类型。为"tag"时，符合此tag的所有物品均可被识别为合成材料；为"item"时，物品的名称与定义一致才会被识别。
   消耗P点量由"power"指定，可以是0到5的任意两位小数。
   产物在"output"对象内指定，为"minecraft:item"时，代表产生物品，物品的类型由"id"指定，数量由"Count"指定，附魔由"Enchantments"指定
3. 更新导入接口
   打开recipes目录下的index.js，加入一行代码。<name>可以是任意没有被其它合成表使用的名称，<file_name>则是第一步创建的文件的名称。

   ``` import {recipe as <name>} from "./craft/<file_name>" ```
   
   在"recipeList"数组中新增一项：<name>。
4. 定义物品标签（可选）
   物品标签是代表多个物品的一个名称，打开文件"tag_define.js"，照着已有的定义添加即可。

##### 弹幕
<span>&#8195;</span>为御币增加新弹幕种类 <命名符号> 需要添加和修改的文件：

BP
+ entities：复制 danmaku_basic_pellet.json，修改文件名和标识符，名称格式为"thlmd:danmaku_basic_<命名符号>"
+ items：复制 hakurei_gohei_pellet.json，修改文件名和标识符，名称、ammunition，格式为"hakurei_gohei_<命名符号>"；修改"minecraft:projectile"属性下的弹幕名称，格式为"thlmd:danmaku_basic_<命名符号>"
+ scripts/entities/danmaku/main.js：在DanmakuTypes新增spellcard标识符及对应<命名符号>
+ scripts/recipes/tag_define.js：在"thlm:gohei" 补充物品标识符。格式为 "hakurei_gohei_<命名符号>"

RP
+ models/entity/damaku_basic.json 在文件内追加弹幕的模型，格式为"hakurei_gohei_<命名符号>"
+ attachables：复制 hakurei_gohei_pellet.json，修改文件名、标识符
+ entity：复制damaku_basic_pellet.json，修改文件名、标识符、texture和geometry，标识符格式为"geometry.danmaku_basic_<命名符号>"
+ textures/entity：补充弹幕材质。
+ texts/en_us 和 zh_CN：暂无。