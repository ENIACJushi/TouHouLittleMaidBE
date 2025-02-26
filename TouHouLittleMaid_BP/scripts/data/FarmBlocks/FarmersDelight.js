export const Data = {
    tester: "farmersdelight:tomato_seeds", // 判断该模组是否被装载的物品
    crops: {
        // 番茄
        "farmersdelight:tomato_block": { "state": { "farmersdelight:growth": 7 }, "seed": "farmersdelight:tomato_seeds",
            "keep": { "block": "farmersdelight:tomato_block", "state": { "farmersdelight:growth": 4 }, "loot": "farmersdelight/crops/farmersdelight_tomato_riped" } },
        // 洋葱
        "farmersdelight:onion_block": { "state": { "farmersdelight:growth": 3 }, "seed": "farmersdelight:onion",
            "keep": { "block": "farmersdelight:onion_block", "state": { "farmersdelight:growth": 0 }, "loot": "farmersdelight/crops/farmersdelight_onion_riped" } },
        // 卷心菜
        "farmersdelight:cabbage_block": { "state": { "farmersdelight:growth": 7 }, "seed": "farmersdelight:cabbage_seeds",
            "keep": { "block": "farmersdelight:cabbage_block", "state": { "farmersdelight:growth": 0 }, "loot": "farmersdelight/crops/farmersdelight_cabbage_riped" } },
        // 水稻
        "farmersdelight:rice_block_upper": { "state": { "farmersdelight:growth": 3 }, "seed": "farmersdelight:rice",
            "keep": { "block": "farmersdelight:rice_block_upper", "state": { "farmersdelight:growth": 0 }, "loot": "farmersdelight/crops/farmersdelight_rice_riped" } },
        // 原版作物的乐土收获（没有猪笼草）
        "farmersdelight:rich_soil_carrot": { "state": { "farmersdelight:growth": 7 }, "seed": "minecraft:carrot" },
        "farmersdelight:rich_soil_wheat": { "state": { "farmersdelight:growth": 7 }, "seed": "minecraft:wheat_seeds" },
        "farmersdelight:rich_soil_beetroot": { "state": { "farmersdelight:growth": 7 }, "seed": "minecraft:beetroot_seeds" },
        "farmersdelight:rich_soil_potato": { "state": { "farmersdelight:growth": 7 }, "seed": "minecraft:potato" },
        "farmersdelight:rich_soil_torchflower": { "state": undefined, "seed": "minecraft:torchflower_seeds" }
    },
    seeds: {
        // 番茄
        "farmersdelight:tomato_seeds": [{
                "block": "farmersdelight:tomato_block", "state": { "farmersdelight:growth": 0 }, "land": ["minecraft:farmland", "farmersdelight:rich_soil_farmland"]
            }],
        // 洋葱
        "farmersdelight:onion": [{
                "block": "farmersdelight:onion_block", "state": { "farmersdelight:growth": 0 }, "land": ["minecraft:farmland", "farmersdelight:rich_soil_farmland"]
            }],
        // 卷心菜
        "farmersdelight:cabbage_seeds": [{
                "block": "farmersdelight:cabbage_block", "state": { "farmersdelight:growth": 0 }, "land": ["minecraft:farmland", "farmersdelight:rich_soil_farmland"]
            }],
        // 水稻  可以种在水下任意土类方块上，自动种植会种的到处都是
        // "farmersdelight:rice" : {
        //     "block": "farmersdelight:rice_block" , "state": {"farmersdelight:age": 0, "farmersdelight:upper": false}, 
        //     "land": ["minecraft:dirt", "minecraft:grass", "farmersdelight:rich_soil_farmland", "farmersdelight:rich_soil"]
        // }
        // 原版作物的乐土种植（没有猪笼草）
        "minecraft:carrot": [{ "block": "farmersdelight:rich_soil_carrot", "state": { "farmersdelight:growth": 0 }, "land": ["farmersdelight:rich_soil_farmland"] }],
        "minecraft:potato": [{ "block": "farmersdelight:rich_soil_potato", "state": { "farmersdelight:growth": 0 }, "land": ["farmersdelight:rich_soil_farmland"] }],
        "minecraft:wheat_seeds": [{ "block": "farmersdelight:rich_soil_wheat", "state": { "farmersdelight:growth": 0 }, "land": ["farmersdelight:rich_soil_farmland"] }],
        "minecraft:beetroot_seeds": [{ "block": "farmersdelight:rich_soil_beetroot", "state": { "farmersdelight:growth": 0 }, "land": ["farmersdelight:rich_soil_farmland"] }],
        "minecraft:torchflower_seeds": [{ "block": "farmersdelight:rich_soil_torchflower_crop", "state": { "farmersdelight:growth": 0 }, "land": ["farmersdelight:rich_soil_farmland"] }]
    }
};
//# sourceMappingURL=FarmersDelight.js.map