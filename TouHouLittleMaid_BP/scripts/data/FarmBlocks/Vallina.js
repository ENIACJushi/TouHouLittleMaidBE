export const Data = {
    tester: "minecraft:carrot", // 判断该模组是否被装载的物品
    crops: {
        "minecraft:carrots": { "state": { "growth": 7 }, "seed": "minecraft:carrot" },
        "minecraft:wheat": { "state": { "growth": 7 }, "seed": "minecraft:wheat_seeds" },
        "minecraft:beetroot": { "state": { "growth": 7 }, "seed": "minecraft:beetroot_seeds" },
        "minecraft:potatoes": { "state": { "growth": 7 }, "seed": "minecraft:potato" },
        "minecraft:nether_wart": { "state": { "age": 3 }, "seed": "minecraft:nether_wart" },
        "minecraft:torchflower": { "state": undefined, "seed": "minecraft:torchflower_seeds" },
        "minecraft:pitcher_crop": { "state": { "upper_block_bit": false, "growth": 4 }, "seed": "minecraft:pitcher_pod" }
    },
    seeds: {
        "minecraft:carrot": [{ "block": "minecraft:carrots", "state": { "growth": 0 }, "land": ["minecraft:farmland"] }],
        "minecraft:wheat_seeds": [{ "block": "minecraft:wheat", "state": { "growth": 0 }, "land": ["minecraft:farmland"] }],
        "minecraft:beetroot_seeds": [{ "block": "minecraft:beetroot", "state": { "growth": 0 }, "land": ["minecraft:farmland"] }],
        "minecraft:potato": [{ "block": "minecraft:potatoes", "state": { "growth": 0 }, "land": ["minecraft:farmland"] }],
        "minecraft:nether_wart": [{ "block": "minecraft:nether_wart", "state": { "age": 0 }, "land": ["minecraft:soul_sand"] }],
        "minecraft:torchflower_seeds": [{ "block": "minecraft:torchflower_crop", "state": { "growth": 0 }, "land": ["minecraft:farmland"] }],
        "minecraft:pitcher_pod": [{ "block": "minecraft:pitcher_crop", "state": { "upper_block_bit": false, "growth": 0 }, "land": ["minecraft:farmland"] }]
    }
};
//# sourceMappingURL=Vallina.js.map