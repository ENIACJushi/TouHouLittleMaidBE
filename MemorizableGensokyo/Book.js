import { resolveRecipe } from './RecipeResolver.js';
import { getItemFont } from './ItemList.js'
import * as fs from 'fs';

const GLYPH_IMG = 0xE500;
const GLYPH_ITEM = 0xE600;
const RECIPE_PATH = "../TouHouLittleMaid_BP/recipes/"
const TEMPLATE_CRAFT =  `
   0 1 2
   ${String.fromCharCode(GLYPH_IMG)}         c
   3 4 5 ${String.fromCharCode(GLYPH_ITEM+2)} r

   6 7 8
`
const TEMPLATE_ALTAR = `
     01
  ${String.fromCharCode(GLYPH_IMG+1)}               2      3 ${String.fromCharCode(GLYPH_ITEM+2)} r

  4      5    §cP:power§r
`
export class Book {
    /**
     * @param {Number} id 书本id
     */
    constructor(id){
        this.bookId = id;
        this.langs = new Map();
        this.pages = [];
        this.invalidItems = new Set();
    }
    /**
     * 
     * @param {Number} page 页数
     * @param {String} value 内容
     * @param {boolean} trim 
     */
    setLang(page, value, trim=true){
        let key = `tlm.${Book.getSeqStr(this.bookId)}.${Book.getSeqStr(page)}`;
        // 去除末尾的换行和空格
        let res = value;
        if(trim){
            while(true){
                if(res.endsWith(' ')){
                    res = res.substring(0, res.length - 1);
                }
                else if(res.endsWith('%1')){
                    res = res.substring(0, res.length - 2);
                }
                else{
                    break;
                }
            }
        }
        this.langs.set(key, res);
        return key;
    }
    /**
     * 导出所有页
     * @returns {String[]}
     */
    exportPages(){
        let res = [];
        this.pages.forEach((page)=>{
            res.push(JSON.stringify(page));
        })
        return res;
    }
    /**
     * 导出所有语言文本
     */
    exportLangs(align){
        let res = [];
        for(let [key, value] of this.langs){
            res.push(`${key}=${value}`);
        }
        return res;
    }
    /**
     * 对齐 若页数小于所给值，则在末尾填充空text页面
     * @param {Number} n 
     */
    align(n){
        while(this.pages.length < n){
            this.addText(' ', false);
        }
    }
    /**
     * 解析一组书籍数据
     * @param {Array} book 
     */
    resolve(book){
        for(let page of book){
            switch(page.type){
                case "text": this.addText(page.content); break;
                case "img" : this.addImg(page.content, page.img); break;
                case "craft": this.addCraft(page.content, page.recipe); break;
                case "altar": this.addAltar(page.content, page.recipe); break;
                case "double_module": this.addDoubleModule(page.content, page.module1, page.module2); break;
                case "placeholder": this. addPlaceholder(); break;
                default: break;
            }
        }
    }
    /**
     * 增加一个纯文本页 文本中的 \n 将会单独列出
     * @param {String} text 
     * @param {boolean} [trim=true]
     */
    addText(text, trim=true){
        let lines = text.replace(new RegExp('\n', 'g'), "%1");
        let key = this.setLang(this.pages.length, lines, trim);
        this.pages.push({"rawtext":[{"translate": key,"with":["\n"]}]});
    }
    /**
     * 增加一个包含单张图片的页面
     * @param {String} text
     * @param {Number} img
     */
    addImg(text, img){
        let lines = text.replace(new RegExp('\n', 'g'), "%1");
        
        let imgStr = Book.resolveImage(img);

        lines = lines.replace("$image$", imgStr);
        
        let key = this.setLang(this.pages.length, lines);
        this.pages.push({"rawtext":[{"translate": key,"with":["\n"]}]});
    }
    /**
     * 增加一个包含工作台合成表的页面
     * @param {String} text 
     * @param {String} recipePath 
     */
    addCraft(text, recipePath){
        let data = fs.readFileSync(RECIPE_PATH + recipePath, 'utf8');
        let recipeStr = Book.resolveCraft(data);
        
        /// 拼接字符串
        let res = text.replace('$recipe$', recipeStr);
        res = res.replace(new RegExp('\n', 'g'), "%1");

        let key = this.setLang(this.pages.length, res);
        this.pages.push({"rawtext":[{"translate": key,"with":["\n"]}]});
    }

    /**
     * 增加一个包含祭坛合成表的页面
     * @param {String} text 
     * @param {{output:{type:String}; power:Number; ingredients: {tag:String; item:String}[]}} recipe 
     */
    addAltar(text, recipe){
        let recipeStr = Book.resolveAltar(recipe);

        /// 拼接字符串
        let res = text.replace('$recipe$', recipeStr);
        res = res.replace(new RegExp('\n', 'g'), "%1");

        let key = this.setLang(this.pages.length, res);
        this.pages.push({"rawtext":[{"translate": key,"with":["\n"]}]});
    }
    /**
     * 增加一个包含两种特殊模块的页面
     * @param {String} text
     * @param {{type: String}} module1
     * @param {{type: String}} module2
     */
    addDoubleModule(text, module1, module2){
        let res = text.replace('$module1$', Book.resolveModule(module1));
        res = res.replace('$module2$', Book.resolveModule(module2));
        
        /// 拼接字符串
        res = res.replace(new RegExp('\n', 'g'), "%1");

        let key = this.setLang(this.pages.length, res);
        this.pages.push({"rawtext":[{"translate": key,"with":["\n"]}]});
    }
    
    addPlaceholder(){
        this.addText(' ', false);
    }

    addInvalidItem(name){
        this.invalidItems.add(`${this.bookId}-${this.pages.length}-${name}`);
    }
    
    //// Tools ////
    static resolveModule(module){
        switch(module.type){
            case "altar": return Book.resolveAltar(module.recipe);
            case "craft": return Book.resolveCraft(module.recipe);
            case "img"  : return Book.resolveImage(module.img);
            default: return '';
        }
    }
    static resolveAltar(recipe){
        let recipeStr = TEMPLATE_ALTAR;

        // 材料
        for(let i = 0; i < 6; i++){
            if(recipe.ingredients[i] === undefined){
                recipeStr = recipeStr.replace(i.toString(), String.fromCodePoint(GLYPH_ITEM));
            }
            else{
                let fontSeq = getItemFont(recipe.ingredients[i]["item"] ?? recipe.ingredients[i]["tag"]);
                if(fontSeq === undefined){
                    this.addInvalidItem(recipe.ingredients[i]["item"] ?? recipe.ingredients[i]["tag"])
                }
                else{
                    recipeStr = recipeStr.replace(i.toString(), String.fromCodePoint(GLYPH_ITEM + fontSeq));
                }
            }
        }
        // 产物
        let resultType = recipe.output.type;
        if(resultType === "minecraft:item"){
            resultType = recipe.output.nbt.Item.id;
        }
        else if(resultType === "thlm:repair"){
            resultType = recipe.output.item.target.tag ?? recipe.output.item.target.item;
        }
        let fontSeq = getItemFont(resultType);
        if(fontSeq === undefined){
            this.addInvalidItem(recipe.output.type);
        }
        else{
            recipeStr = recipeStr.replace('r', String.fromCodePoint(GLYPH_ITEM + fontSeq));
        }

        // p值
        recipeStr = recipeStr.replace("power", recipe.power.toFixed(2));
        return recipeStr;
    }
    static resolveCraft(data){
        /// 解析合成表
        let recipe = resolveRecipe(JSON.parse(data));

        let recipeStr = TEMPLATE_CRAFT;
        // 材料
        for(let i = 0; i < 9; i++){
            if(recipe.material[i] === undefined){
                recipeStr = recipeStr.replace(i.toString(), String.fromCodePoint(GLYPH_ITEM));
            }
            else{
                let fontSeq = getItemFont(recipe.material[i]);
                if(fontSeq === undefined){
                    this.addInvalidItem(recipe.material[i])
                }
                else{
                    recipeStr = recipeStr.replace(i.toString(), String.fromCodePoint(GLYPH_ITEM + fontSeq));
                }
            }
        }
        // 产物
        let fontSeq = getItemFont(recipe.result.name);
        if(fontSeq === undefined){
            this.addInvalidItem(recipe.result.name)
        }
        else{
            recipeStr = recipeStr.replace('r', String.fromCodePoint(GLYPH_ITEM + fontSeq));
        }
        recipeStr = recipeStr.replace('c', recipe.result.count === 1 ? ' ' :  recipe.result.count.toString());

        return recipeStr;
    }
    static resolveImage(img){
        return `%1%1%1       ${String.fromCharCode(GLYPH_IMG + img)}%1%1%1`;
    }
    /**
     * 获取页码字符
     * @param {Number} seq 
     */
    static getSeqStr(seq){
        return seq.toString();
    }
}