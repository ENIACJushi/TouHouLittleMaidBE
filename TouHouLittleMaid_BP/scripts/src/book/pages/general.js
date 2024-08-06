import { recipeList } from "../../../data/recipes/index"

/**
 * 在 rawtext 中提供 font 图片接口，只需要输入后两位编号即可自动生成图片字符
 *  键名： "font"
 */

export const chapter = {
    "id": "general",
    "title": "General",
    "pages":[
        // 首页 总览
        {
            "title": "me.chapter1.page1.title",
            "content": [
                {
                    "type": "rawtext",
                    "rawtext":[
                        {"text":"\n"},
                        {"translate":"me.chapter1.page1.title"}, {"text":"\n"},
                        {"translate":"me.chapter1.title.page"}, {"text":"\n"},
                        {"translate":"me.chapter1.page1.text"}
                    ]
                }
            ]
        },
        // 目录
        {
            "title": "me.chapter1.page2.title",
            "content": [
                { // 东方project
                    "type": "button",
                    "text": {"rawtext": [{"translate": ""}]},
                    "on_click":{ "type": "page", "chapter": "general", "index": 2 }
                },
                { // 女仆妖精
                    "type": "button",
                    "text": {"rawtext": [{"translate": ""}]},
                    "on_click":{ "type": "page", "chapter": "general", "index": 3 }
                },
                { // Power 道具
                    "type": "button",
                    "text": {"rawtext": [{"translate": ""}]},
                    "on_click":{ "type": "page", "chapter": "general", "index": 4 }
                },
                { // 御币与弹幕
                    "type": "button",
                    "text": {"rawtext": [{"translate": ""}]},
                    "on_click":{ "type": "page", "chapter": "general", "index": 5 }
                },
                { // 多方块祭坛
                    "type": "button",
                    "text": {"rawtext": [{"translate": ""}]},
                    "on_click":{ "type": "page", "chapter": "general", "index": 6 }
                }
            ]
        },
        // 东方 Project
        {
            "title": "me.chapter1.page3.title",
            "content": [
                {
                    "type": "rawtext",
                    "rawtext":[
                        {"text":"\n"},
                        {"translate":"me.chapter1.page3.title"},{"text":"\n"},
                        {"translate":"me.chapter1.page3.text1"},{"text":"\n\n"},
                        {"translate":"me.chapter1.page3.text2"}
                    ]
                }
            ]
        },
        // 女仆妖精
        {
            "title": "me.c1.p4.ti",
            "type": "rawtext",
            "content":[
                {"text":"\n"},{"translate":"me.c1.p4.t1"},
                {"text":"\n\n\n\n"},{"translate":"me.c1.p4.t2"},
                {"text":"\n\n\n\n"},{"translate":"me.c1.p4.t3"}
            ]
        },
        // Power 道具
        // 御币与弹幕
        // 多方块祭坛
        
        {
            "title": "祭坛合成",
            "type": "altar",
            "desc_pre" : {}, // 前置 rawtext
            "recipe"   : recipeList.spawn_lightning_bolt, // 合成表
            "desc_tail": {}  // 后置 rawtext
        },
        {
            "title": "工作台合成",
            "type": "craft",
            "desc_pre" : {}, // 前置 rawtext
            "recipe"   : [
                [0,0,0],
                [0,0,0],
                [0,0,0]
            ], // 合成表
            "desc_tail": {}  // 后置 rawtext
        }
    ]
}
