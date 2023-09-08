import { Dimension, Items, ItemStack, Player } from "mojang-minecraft";
import * as Tool from "../libs/scarletToolKit"
import { recipeList } from "../recipes/index"
import { tagDefines } from "../recipes/tag_define"
import { get_power_number, set_power_number } from "../entities/power_point";


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
        let power = get_power_number(player.name);
        if(1 <= amount && amount <= 6){
            for(let recipe of this.recipes[amount - 1]){
                if(this.matchRecipe(itemStacks, recipe["ingredients"])){
                    let after_power = power - Math.floor(recipe["power"]*100);
                    if(after_power >= 0){
                        this.summonOutput(outputDimension, outputLocation, recipe.output);
                        set_power_number(player.name, after_power);
                        return true;
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

    isItemMatchDefine(itemStack, define){
        let matchAtLeastOne = false;
        // Item label
        if(define.item) {
            if(itemStack.id != define.item){
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
    summonOutput(dimension, location, output){
        switch(output.type){
            case "minecraft:item":
                let itemInfo = output["nbt"]["Item"];
                let amount = 1;
                let data = 0;
                if(!itemInfo["id"]) return false;
                if(itemInfo["Count"]) amount = itemInfo["Count"];
                if(itemInfo["data"]) data = itemInfo["data"];
                dimension.spawnItem(new ItemStack(Items.get(itemInfo["id"]), amount, data), location);
                break;
            default:
                dimension.spawnEntity(output.type, location);
                break;
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
            Tool.logger(`${i}: ${this.path[i]}`);
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