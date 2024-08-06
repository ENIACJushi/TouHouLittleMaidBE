import { ItemStack, Player } from "@minecraft/server";
import { config } from "../controller/Config";
import { getPlayerMainHand, lore2Str, str2Lore } from "../libs/ScarletToolKit";

const glyph1 = config.glyph * 0x100;
const glyph2 = glyph1 + 0x100;
const bookItem = "touhou_little_maid:memorizable_gensokyo"
/**
 * 语言切换
 * 跳页
 * 再次打开时的阅读位置记录（记在lore里）
 */

export class MemorizableGensokyo{
    /**
     * @param {Player} player 
     */
    constructor(player){
        this.player = player;

        let book = this.getBook();
        if(book===undefined) return false;

        // 使用物品初始化数据
        let lore = book.getLore();
        if(lore.length === 0){
            this.config = new BookConfig();
        }
        else{
            this.config = new BookConfig(lore2Str(lore));
        }

        return true;
    }
    /**
     * 将当前设置写入书本物品
     * @returns {ItemStack|undefined}
     */
    writeItem(){
        let book  = this.getBook();
        if(book===undefined) return false;
        book.setLore(str2Lore(this.config.toString()));
        return book;
    }
    /**
     * 获取玩家主手的书本物品，若不是书本则返回 undefined
     * @returns {ItemStack|undefined}
     */
    getBook(){
        let bookItem = getPlayerMainHand(this.player);
        if(bookItem === undefined || bookItem.typeId !== bookItem) return undefined;
        return bookItem;
    }
    /**
     * 展示一页
     * @param {Object} pageData 
     */
    showPage(pageData){

    }
    /**
     * 主目录
     */
    main(){

    }

    general(){

    }

    maid(){

    }
    
    others(){

    }
}

class BookConfig{
    values = {
        "l": 0, // language
        "c": 0, // chapter
        "p": 0  // page
    }
    constructor(){}
    constructor(str){
        this.values = JSON.parse(str);
    }
    toString(){
        return JSON.stringify(this.values);
    }

    setLanguage(value){
        this.values["l"] = value;
    }
    setChapter(value){
        this.values["c"] = value;
    }
    setPage(value){
        this.values["p"] = value;
    }
}