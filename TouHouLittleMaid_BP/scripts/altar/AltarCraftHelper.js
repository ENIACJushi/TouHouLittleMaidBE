import { Dimension, ItemStack, Player, Enchantment, ItemEnchantsComponent, Vector } from "@minecraft/server";
import * as Tool from "../libs/scarletToolKit"
import { recipeList } from "../recipes/index"
import { tagDefines } from "../recipes/tag_define"
import PowerPoint from "../entities/power_point";


export class AltarCraftHelper{
    constructor(){
        this.recipes = [[], [], [], [], [], []];
        this.tags = tagDefines;
        for(let recipe of recipeList){
            this.addRecipe(recipe);
        }

    }
    addRecipe(recipe){
        let amount = recipe["ingredients"].length;
        if(amount && 1 <= amount && amount <= 6){
            this.recipes[amount - 1].push(recipe);
            return true;
        }
        return false;
    }
    addTagDefine(define){
        if(!this.tags[define["name"]]){
            this.tags[define["name"]] = define["data"];
        }
    }
    /**
     * @param {Player} player 
     * @param {ItemStack[]} itemStacks 
     * @param {Dimension} outputDimension 
     * @param {Location} outputLocation 
     */
    matchRecipes(player, itemStacks, outputDimension, outputLocation){
        let amount = itemStacks.length;
        let power = PowerPoint.get_power_number(player.name);
        if(1 <= amount && amount <= 6){
            for(let recipe of this.recipes[amount - 1]){
                if(this.matchRecipe(itemStacks, recipe["ingredients"])){
                    let after_power = power - Math.floor(recipe["power"]*100);
                    if(after_power >= 0){
                        if(this.summonOutput(outputDimension, outputLocation, recipe.output, itemStacks)){
                            PowerPoint.set_power_number(player.name, after_power);
                            return true;
                        }
                        return false;
                    }
                    else{
                        Tool.title_player_actionbar_translate(player.name, "message.touhou_little_maid:altar.not_enough_power.name")
                    }
                }
            }
        }
        return false;
    }
    matchRecipe(itemStacks, ingredients){
        // Hungarian algorithm
        let count = itemStacks.length;
        let edge = [];
        for(let item = 0; item < count; item++){
            edge[item] = [];
            for(let define = 0; define < count; define++){
                edge[item][define] = this.isItemMatchDefine(itemStacks[item], ingredients[define]);
            }
        }

        let hungaryMatch = new HungaryMatch(count, edge).match();
        return hungaryMatch;
    }
    /**
     * 
     * @param {ItemStack} itemStack 
     * @param {string} define 
     * @returns 
     */
    isItemMatchDefine(itemStack, define){
        let matchAtLeastOne = false;
        // Item label
        if(define.item) {
            if(itemStack.typeId != define.item){
                return false;
            }
            else{
                matchAtLeastOne = true;
            }
        }
        
        // Tag label
        if(define.tag && this.tags[define.tag]){
            let success = false;
            for(let tagDefine of this.tags[define.tag]){
                if(this.isItemMatchDefine(itemStack, tagDefine)){
                    success = true;
                    matchAtLeastOne = true;
                    break;
                }
            }
            if(!success) return false;
        }
        
        // Return
        return matchAtLeastOne;
    }
    /**
     * 
     * @param {Dimension} dimension 
     * @param {Vector} location 
     * @param {*} output 
     * @param {*} itemStacks 
     * @returns 
     */
    summonOutput(dimension, location, output, itemStacks){
        try{
            switch(output.type){
                case "minecraft:item":
                    let itemInfo = output["nbt"]["Item"];
                    let amount = 1;
                    let data = 0;
                    if(!itemInfo["id"]) return false;
                    if(itemInfo["Count"]) amount = itemInfo["Count"];
                    let output_item = new ItemStack(itemInfo["id"], amount);
                    if(itemInfo["Enchantments"] != null){
                        let ench_list = output_item.getComponent("minecraft:enchantments").enchantments
                        for(let key in itemInfo["Enchantments"]){
                            ench_list.addEnchantment(new Enchantment(key, itemInfo["Enchantments"][key]));
                        }
                        output_item.getComponent("minecraft:enchantments").enchantments = ench_list;
                    }
                    dimension.spawnItem(output_item, location);
                    break;
                case "thlm:repair":
                    for(let source_item of itemStacks){
                        if(this.isItemMatchDefine(source_item, output.item["target"])){
                            let output_item = source_item.clone();
                            let durability = output_item.getComponent("minecraft:durability");
                            durability.damage = Math.max(0, durability.damage - output.item["amount"])
                            dimension.spawnItem(output_item, location);
                            return true;
                        }
                    }
                    break;
                default:
                    dimension.spawnEntity(output.type, location);
                    break;
            }
            return true;
        }
        catch{
            return false;
        }
    }
}

class HungaryMatch{
    constructor(count, edge){
        this.count = count;
        this.edge = edge;
        this.path = [];
        this.on_path = [];
        for (let j = 0 ; j < count ; j++) {
            this.path[j] = -1;
            this.on_path[j] = false;
        }
    }
    outputRes(){
        for (let i = 0 ; i < this.count; i++) {
        }
    }
    clearOnPathSign(){
        for (let j = 0 ; j < this.count; j++) {
            this.on_path[j] = false;
        }
       
    }
    // DFS
    findAugPath(xi){
        for (let yj = 0 ; yj < this.count; yj++) {
            if ( this.edge[xi][yj] == true && !this.on_path[yj]) {
                this.on_path[yj] = true;
                if (this.path[yj] == -1 || this.findAugPath(this.path[yj])) {
                    this.path[yj] = xi;
                    return true;
                }
            }
        }
        return false;
    }
    
    isPerfect(){
        for (let i = 0 ; i < this.count; i++) {
            if(this.path[i] == -1) return false;
        }
        return true;
    }
    match(){
        for (let xi = 0; xi < this.count; xi++) {
            this.findAugPath(xi);
            this.clearOnPathSign();
        }
        return this.isPerfect();
    }
}
export const altarCraft = new AltarCraftHelper();