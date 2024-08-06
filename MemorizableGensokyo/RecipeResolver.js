// 无序合成物品数量对应的九宫格显示位置
const shapelessPos = [
    undefined,
    [4],
    [3, 4],
    [3, 4, 5],
    [0, 1, 3, 4],
    [0, 1, 2, 3, 4],
    [0, 1, 2, 3, 4, 5],
    [0, 1, 2, 3, 4, 5, 6],
    [0, 1, 2, 3, 4, 5, 6, 7],
    [0, 1, 2, 3, 4, 5, 6, 7, 8]
]
/**
 * 返回长度为 10 的一维数组
 * @param {Object} recipe 
 * @returns {{material : String[]; result: { name: String; count: Number}}} 
 */
export function resolveRecipe(recipe){
    // 有序合成
    if(recipe["minecraft:recipe_shaped"] !== undefined){
        let info = recipe["minecraft:recipe_shaped"];
        // 解析九宫格
        let res = Array.from(info["pattern"][0]);
        res = res.concat(Array.from(info["pattern"][1]));
        res = res.concat(Array.from(info["pattern"][2]));

        // 解析物品，得到标识符
        let names = {};
        for(let key in info["key"]){
            let name = resolveMeterial(info["key"][key]);
            if(name === undefined) return undefined;
            names[key] = name;
        }

        // 替换 key
        for(let i = 0; i < res.length; i++){
            if(res[i] === " ") res[i] = undefined;
            else res[i] = names[res[i]]
        }
        
        let resultName = info["result"]["item"];
        if(info["result"]["data"] !== undefined) resultName += `:${info["result"]["data"]}`;

        // 返回结果
        return {
            material: res,
            result: {
                "name": resultName,
                "count": info["result"]["count"]===undefined?1:info["result"]["count"]
            }
        }
        

    }
    // 无序合成
    else if(recipe["minecraft:recipe_shapeless"] !== undefined){
        let info = recipe["minecraft:recipe_shapeless"];
        let ingredients = info["ingredients"]
        
        let res = new Array(9).fill(undefined);
        let pos = shapelessPos[ingredients.length];

        for(let i = 0; i < ingredients.length; i++){
            let name = resolveMeterial(ingredients[i]);
            if(name === undefined) return undefined;
            res[pos[i]] = name;
        }
        let resultName = info["result"]["item"];
        if(info["result"]["data"] !== undefined) resultName += `:${info["result"]["data"]}`;
        
        return {
            material: res,
            result: {
                "name": resultName,
                "count": info["result"]["count"]===undefined?1:info["result"]["count"]
            }
        }
    }
    // 错误
    return undefined;
}

/**
 * 解析材料定义
 * @param {Object} definition 
 * @returns {String}
 */
function resolveMeterial(definition){
    if(definition["item"] !== undefined){
        let name = definition["item"];
        if(definition["data"] !== undefined) name += `:${definition["data"]}`;
        return name;
    }
    else if(definition["tag"] !== undefined){
        let name = definition["tag"];
        return name;
    }
    else{
        console.log("未知的合成材料:" + definition);
        return undefined;
    }
}