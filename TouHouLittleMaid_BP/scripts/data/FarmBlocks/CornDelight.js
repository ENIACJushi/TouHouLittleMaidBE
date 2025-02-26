export const Data = {
    tester: "corn_delight:corn_seeds", // 判断该模组是否被装载的物品
    crops: {
        // 玉米
        "corn_delight:corn_crop": { "state": { "corn_delight:growth": 7, "corn_delight:upper": false }, "seed": "corn_delight:corn_seeds" }
    },
    seeds: {
        // 玉米
        "corn_delight:corn_seeds": [{
                "block": "corn_delight:corn_crop", "state": { "corn_delight:growth": 0, "corn_delight:upper": false }, "land": ["minecraft:farmland", "farmersdelight:rich_soil_farmland"]
            }]
    }
};
//# sourceMappingURL=CornDelight.js.map