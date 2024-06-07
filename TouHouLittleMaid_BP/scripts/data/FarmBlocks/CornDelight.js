export const Data = {
    tester: "corn_delight:corn_seeds", // 判断该模组是否被装载的物品

    crops: { // 定义方块达到成熟时的状态（state），以及何种种子（seed）能种出这种作物
        // 玉米
        "corn_delight:corn_crop" : {"state": {"corn_delight:growth": 7, "corn_delight:upper": false}, "seed": "corn_delight:corn_seeds" }
    },

    seeds: { // 定义种子种出的方块（block，state），以及需要在何种方块（land）上种植
        // 玉米
        "corn_delight:corn_seeds" : {
            "block": "corn_delight:corn_crop" , "state": {"corn_delight:growth": 0, "corn_delight:upper": false}, "land": ["minecraft:farmland", "farmersdelight:rich_soil_farmland"]}
    }
}