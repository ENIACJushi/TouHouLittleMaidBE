import { ItemStack, ItemUseBeforeEvent, Player } from "@minecraft/server";
import { getPlayerMainHand, logger, lore2Str, setPlayerMainHand, str2Lore } from "../libs/ScarletToolKit";
import * as mcui from '@minecraft/server-ui';

// 书本各章节的页码号(自动生成)
// MG_AUTO_GENERATE_START
const BOOK = [12,16,10];
// MG_AUTO_GENERATE_END

const chapterButtonDelta = BOOK.length + BOOK.length % 2;

export class MemorizableGensokyo{
    /**
     * 
     * @param {ItemUseBeforeEvent} event 
     */
    static onUseEvent(event){
        let book = getPlayerMainHand(event.source);
        if(book===undefined) return;
        let page = this.getBookPage(book)
        this.sendForm(event.source, page.chapter, page.page);
    }
    /**
     * 
     * @param {Player} pl
     * @param {Number} chapter 打开书的章节，为负时在首页
     * @param {Number} page 章节的页面
     */
    static sendForm(pl, chapter, page){
        let bodyStr = "";
        // 计算章节页码起点
        let startPage = 0;
        let chapterStart = [];
        BOOK.forEach((val)=>{ chapterStart.push(startPage.toString().padStart(3, '0')); startPage += val; });

        // 数字大小有限制，需要用字母分隔各个数据段 这是一个拥有九章的书的字符：999999999a999999999b999999999c999999999d
        // 巧合的是头部数据段正好到达最大展示长度：章节数[2]|总页数[3]|当前页码[3]|是否在首页(0/1) 如 999999999
        let body1 = [];
        body1.push(BOOK.length.toString().padStart(2, '0')); // 章节数[2]
        body1.push(startPage.toString().padStart(3, '0')); // 总页数[3]
        body1.push(this.getTotalByChapter(chapter, page).toString().padStart(3, '0')); // 当前页码[3]
        body1.push(chapter===-1?'1':'0'); // 是否在首页(0/1)
        bodyStr += '_1' + body1.join('') + 'a';

        // ...|章节1页码起点[3]| 之后的数据三个为一组
        let chapterPtr = 0;
        let spilter = 'bcdefghijklmnopqrstuvwxyz';
        let i = 0;
        while(true){
            let segment = "";
            for(let i = 0; i < 3; i++){
                if(chapterPtr >= chapterStart.length) break;
                segment = chapterStart[chapterPtr] + segment;
                chapterPtr++;
            }
            segment += spilter[i];
            segment = segment.padStart(10, '0');
            bodyStr += "_1" + segment;
            i++;
            if(chapterPtr >= chapterStart.length) break;
        }
        const form = new mcui.ActionFormData()
            .title('/TLM_B textures/ui/tlm_book_title') // 头图
            .body(bodyStr)
            // 奇数章节要补一个占位按钮凑成偶数（手动补充）
            .button({"rawtext":[{"translate":"tlm.book.chapter1"}]}, "textures/items/memorizable_gensokyo")
            .button({"rawtext":[{"translate":"tlm.book.chapter2"}]}, "textures/ui/chapter_maid")
            .button({"rawtext":[{"translate":"tlm.book.chapter3"}]}, "textures/items/microwaver/magic_powder")
            .button("placeholder")
        // 章节内容
        for(let i = 0; i < BOOK.length; i++){
            for(let i2 = 0; i2 < BOOK[i]; i2++){
                form.button({"rawtext":[{"translate":`tlm.${i}.${i2}`,"with":["\n"]}]})
            }
        }
        // 发送
        form.show(pl).then((response)=>{
            // 设置指南书页号 tlmb:<chapter>:<page>
            let book = getPlayerMainHand(pl);
            if(book!==undefined && book.typeId==="touhou_little_maid:memorizable_gensokyo"){
                // 在首页退出时，selection 为 undefined
                let page = this.getChapterByTotal(response.selection);
                this.setBookPage(book, page.chapter, page.page);
                setPlayerMainHand(pl, book);
            }
        });
    }
    /**
     * 根据总页号获取章节和章节页码
     * @param {Number} _page_total 总页号
     * @returns {{chapter:Number; page:Number}}
     */
    static getChapterByTotal(_page_total){
        if(_page_total===undefined) return {chapter: -1, page: 0};

        let page_total = _page_total-chapterButtonDelta;

        let chapter = 0;
        let page = page_total;
        for(; chapter < BOOK.length; chapter++){
            if(page >= BOOK[chapter]){
                page -= BOOK[chapter];
            }
            else break;
        }
        return {chapter: chapter, page: page};
    }
    /**
     * 根据章节和页码获得总页号
     * @param {Number} chapter 
     * @param {Number} page 
     */
    static getTotalByChapter(chapter, page){
        if(chapter===undefined||chapter<0||page===undefined||page<0) return 0; // 在首页时返回任意非负数即可
        let res = page;
        for(let i = 0; i < chapter; i++){
            res += BOOK[i];
        }
        return res;
    }
    /**
     * 设置书本页码
     * @param {ItemStack} itemStack 
     * @param {String} chapter 
     * @param {String} page 
     */
    static setBookPage(itemStack, chapter, page){
        itemStack.setLore(str2Lore(`tlmb:${chapter}:${page}`));
    }
    /**
     * 获取书本页码
     * @param {ItemStack} itemStack
     * @returns {{chapter:Number; page:Number}}
     */
    static getBookPage(itemStack){
        let lore = itemStack.getLore()
        if(lore !== undefined && lore.length === 1){
            let str = lore2Str(lore[0]);
            str = str.split(':');
            return {chapter: parseInt(str[1]), page: parseInt(str[2])};
        }
        else return {chapter:-1,page:0};
    }
}