export const Data = {
    tester: "餐厨工艺:白菜", // 判断该模组是否被装载的物品

    crops: { // 定义方块达到成熟时的状态（state），以及何种种子（seed）能种出这种作物
        "餐厨工艺:白菜_植株" : {"state": {"zhizhu:xxx": 6}, "seed": "餐厨工艺:白菜种子"},
        "餐厨工艺:白萝卜_植株" : {"state": {"zhizhu:xxx": 6}, "seed": "餐厨工艺:白萝卜种子"},
        "餐厨工艺:大豆_植株" : {"state": {"zhizhu:xxx": 6}, "seed": "餐厨工艺:大豆种子"},
        "餐厨工艺:番茄_植株" : {"state": {"zhizhu:xxx": 6}, "seed": "餐厨工艺:番茄种子"},
        "餐厨工艺:红薯_植株" : {"state": {"zhizhu:xxx": 6}, "seed": "餐厨工艺:红薯种子"},
        "餐厨工艺:黄瓜_植株" : {"state": {"zhizhu:xxx": 6}, "seed": "餐厨工艺:黄瓜种子"},
        "餐厨工艺:茄子_植株" : {"state": {"zhizhu:xxx": 6}, "seed": "餐厨工艺:茄子种子"},
        "餐厨工艺:辣椒_植株" : {"state": {"zhizhu:lajiao": 6}, "seed": "餐厨工艺:辣椒种子"},
        "餐厨工艺:青椒_植株" : {"state": {"zhizhu:lajiao": 6}, "seed": "餐厨工艺:青椒种子"},
        "餐厨工艺:水稻_植株_0" : {"state": {"zhizhu:xxx": 6}, "seed": "餐厨工艺:水稻种子"},
        "餐厨工艺:玉米_植株_0" : {"state": {"zhizhu:xxx": 6}, "seed": "餐厨工艺:玉米种子"}
    },

    seeds: { // 定义种子种出的方块（block，state），以及需要在何种方块（land）上种植
        "餐厨工艺:白菜种子": [{"block": "餐厨工艺:白菜_植株" , "state": {"zhizhu:xxx": 1}, "land": ["minecraft:farmland"]}],
        "餐厨工艺:白萝卜种子": [{"block": "餐厨工艺:白萝卜_植株" , "state": {"zhizhu:xxx": 1}, "land": ["minecraft:farmland"]}],
        "餐厨工艺:大豆种子": [{"block": "餐厨工艺:大豆_植株" , "state": {"zhizhu:xxx": 1}, "land": ["minecraft:farmland"]}],
        "餐厨工艺:番茄种子": [{"block": "餐厨工艺:番茄_植株" , "state": {"zhizhu:xxx": 1}, "land": ["minecraft:farmland"]}],
        "餐厨工艺:红薯种子": [{"block": "餐厨工艺:红薯_植株" , "state": {"zhizhu:xxx": 1}, "land": ["minecraft:farmland"]}],
        "餐厨工艺:黄瓜种子": [{"block": "餐厨工艺:黄瓜_植株" , "state": {"zhizhu:xxx": 1}, "land": ["minecraft:farmland"]}],
        "餐厨工艺:茄子种子": [{"block": "餐厨工艺:茄子_植株" , "state": {"zhizhu:xxx": 1}, "land": ["minecraft:farmland"]}],
        "餐厨工艺:辣椒种子": [{"block": "餐厨工艺:辣椒_植株" , "state": {"zhizhu:lajiao": 1}, "land": ["minecraft:farmland"]}],
        "餐厨工艺:青椒种子": [{"block": "餐厨工艺:青椒_植株" , "state": {"zhizhu:lajiao": 1}, "land": ["minecraft:farmland"]}],
        "餐厨工艺:水稻种子": [{"block": "餐厨工艺:水稻_植株_0" , "state": {"zhizhu:xxx": 1}, "land": ["minecraft:farmland"]}],
        "餐厨工艺:玉米种子": [{"block": "餐厨工艺:玉米_植株_0" , "state": {"zhizhu:xxx": 1}, "land": ["minecraft:farmland"]}]
    }
}
