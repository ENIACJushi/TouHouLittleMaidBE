
【祭坛合成与P点系统】
（待加入）在地牢战利品中加入P点道具（这将会引入一个版本更新时的检查项目）
*（待修复）新版本中手上没有物品则不会触发beforeItemUseOn事件，导致空手取下祭坛上的物品失效，需要另寻它法。目前不是很急，因为可以跳起来取。

-----

【弹幕系统】
类型：PELLET、BALL、ORBS、BIG_BALL（脚本中大写，实体用小写）手持御币潜行即可切换弹种，1秒切换一次。
（待加入）实体不会被同组弹幕击伤。弹幕编组tag前缀：thdg:xxx （touhou danmaku group）
（待加入）妖精女仆：多重弹幕攻击、飞行、掉落P点。或许可以借鉴烈焰人的多实体弹射。
（待加入）追踪符札：[ 纸×3 + 火药 + 炸药/药水/纸 ] 在祭坛消耗0.5P点合成 [ 符札×8 ]。符札会自动追踪发射时瞄准的实体，若发射时视线上没有实体，则自行寻找运行方向上最近的敌对生物；基础伤害等于力量4的弓射出的箭，第三项合成材料为药水时会附带对应的药水效果，时长同药水箭，为炸药时造成范围伤害，为纸时仅造成基础单体伤害。
（待完善）各弹种的判定范围（可能无法实现）


（已加入）PELLET、BALL、ORBS、BIG_BALL弹幕。
（已加入）祭坛合成项目：御币 + 纸×2 + p点×1 → 回复300耐久（修满）
（已完善）同步御币的耐久值（300）
（已完善）御币可被附魔弓的属性(目前仅有无限和耐久可以发挥作用)
（已加入）御币的附着物及发射动画
（已完善）御币发射弹幕的消耗：将自身作为弹药，自带无限附魔。因为合成台不能直接合成带附魔的物品，玩家需要先对空气或方块使用一下合成出来的物品才会转化为真正的御币
+ 新增该物品的语言文本： item.touhou_little_maid:hakurei_gohei_crafting_table
    中 zh_CN: 博丽的御币(未激活)
    越南 vi_vn： Cây Gohei của Hakurei(Không được kích hoạt)
    土耳其 tr_tr： Hakurei'nin Gohei'si(etkinleşmedi)
    俄 ru_ru： Посох Очищения Хакурей(Не активирована)
    葡萄牙(葡萄牙) pt_pt：Gohei de Hakurei(não activado)
    葡萄牙(巴西) pt_br：Gohei de Hakurei(não ativado)
    拉丁 la_la：Gopeis Hacrei(non activated)
    韩 ko_kr：하쿠레이의 무녀봉(활성화되지 않음)
    日 ja_jp：博麗のお祓い棒(アクティブ化されていない)
    意大利 it_it：Gohei Dell' Hakurei(non attivato)
    法 fr_fr：Gohei de Hakurei(non activé)
    西班牙（西班牙）：Gohei de Hakurei(no activado)
    英 en_us：Hakurei's Gohei(not activated)
    德 de_de：没有对应的项目

（已完善）御币切换弹种。添加多种御币，潜行右击地面时，通过脚本切换御币的种类（中间实体没法用，因为获取不到发射者），
+ 新增提示的语言文本
  + 中 zh_CN
    message.touhou_little_maid:hakurei_gohei.switch=切换弹种：
    danmaku.pellet.name=点弹
    danmeku.ball.name=小玉
    danmaku.orbs.name=环玉
    danmaku.big_orb=大玉

-----

【女仆系统】

（特色）好感度。到达一定值可以解锁cosplay服装。互动、赠送礼物可以升高，均有冷却时间；战死、过度工作则会降低。
（特色）学习。学习可以获得经验值，提高等级从而做更多事情，掌握更多技能（如解锁弹幕攻击方式）
（方案）使用实体菜单进行模式选择，为保证准确性，只有静止时才能有效点击。即在坐下状态下菜单才会展开。

-----

【其它】

（待测试）确定各语言文件能被正常使用
（未使用）闪烁材质：见danmaku_basic render的注释部分
