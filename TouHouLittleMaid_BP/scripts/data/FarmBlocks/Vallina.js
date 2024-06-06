export const Data = {
    tester: "minecraft:carrot", // 判断该模组是否被装载的物品

    crops: { // 定义方块达到成熟时的状态，以及何种种子能种出这种作物
        "minecraft:carrots": {"state": {"growth": 7}, "seed": "minecraft:carrot" }
    },

    seeds: { // 定义种子种出的方块，以及需要在何种方块上种植
        "minecraft:carrot": {"block": "minecraft:carrots", "state": {"growth": 7}, "land": ["minecraft:dirt"]}
    }
}
