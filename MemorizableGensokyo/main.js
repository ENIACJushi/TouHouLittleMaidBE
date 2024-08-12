/**
 * 输入一组页面json
 * 分语言输出：
 *  1. 文本(zh_CN.lang, en_US.lang)
 *  2. 逐页的书本 rawtext
 * 提供设置项：
 *  1. glyph 的起始位置
 * 提供模板：
 *  2. image 单图页 (标题 说明 图 说明2)
 *  1. text  文字页 (标题 说明)
 *  3. altar 祭坛合成 (标题 说明 合成表 说明2)
 *  4. craft 有序/无序工作台合成 (标题 说明 合成表路径 说明2)
 * 
 * 约定：
 *  1. 图片占 行
 *  2. 任意模板均会计算行数，若超行，则在对应语言的文本中新插入一页
 *  3. 语言的key格式为：tlm.11 / tlm.2z  后面字符，前一个代表书本编号，后一个是页数
 *  4. 为了一本书通用全部语言，所有语言的总页数都应该相同，这要求文本较短的语言在书的末尾预留出空页
 * 
 * 特性：
 *  1. 换行使用 translate 的 %n 实现，图片则直接嵌入文本中，最大程度缩减rawtext的长度
 */

import * as fs from "fs"
import { Book } from "./Book.js";
const key = ["book1", "book2", "book3"];
// 自动生成信息
const TEXT_PATH = "../TouHouLittleMaid_RP/texts/";
const TEXT_STARTER = "### MG_AUTO_GENERATE_START ###";
const TEXT_ENDER = "### MG_AUTO_GENERATE_END ###";
const SCRIPT_PATH = "../TouHouLittleMaid_BP/scripts/src/book/MemorizableGensokyoUI.js"
const SCRIPT_STARTER = "// MG_AUTO_GENERATE_START";
const SCRIPT_ENDER = "// MG_AUTO_GENERATE_END";

/**
 * 写入语言文件
 * @param {String} name 如 zh_CN
 * @param {String} str 语言字符串
 */
function writeLang(name, str){
    var path = TEXT_PATH + name + ".lang";
    let res = fs.readFileSync(path, "utf-8");

    let starter = res.indexOf(TEXT_STARTER);
    let ender = res.indexOf(TEXT_ENDER);
    if(starter >= 0 && ender >= 0){
        res = res.substring(0, starter) + TEXT_STARTER + '\n' + str + res.substring(ender);
    }
    else{
        res += TEXT_STARTER + "\n";
        res += str + "\n";
        res += TEXT_ENDER + "\n";
    }
    
    fs.writeFile(path, res, 'utf8', (err) => {
        if (err) {
            console.error(`写入${path}.lang文件时发生错误: `, err);
            return;
        }
    });
}
/**
 * 写入脚本文件
 * @param {Number[]} pages 各章长度
 */
function writeScript(pages){
    let res = fs.readFileSync(SCRIPT_PATH, "utf-8");
    let str = `const BOOK = [${pages.toString()}];\n`

    let starter = res.indexOf(SCRIPT_STARTER);
    let ender = res.indexOf(SCRIPT_ENDER);
    if(starter >= 0 && ender >= 0){
        res = res.substring(0, starter) + SCRIPT_STARTER + '\n' + str + res.substring(ender);
    }
    else{
        res += SCRIPT_STARTER + "\n";
        res += str + "\n";
        res += SCRIPT_ENDER + "\n";
    }
    
    fs.writeFile(SCRIPT_PATH, res, 'utf8', (err) => {
        if (err) {
            console.error(`写入 ${SCRIPT_PATH} 文件时发生错误: `, err);
            return;
        }
    });
}
// 读取books/xxx.js文件
let files = fs.readdirSync("./books");
let books = {};
for (let index = 0; index < files.length; index++) {
    const element = files[index];
    
    console.log(element);
    // import 加载
    books[element] = await import(`./books/${element}`);
}

// 获取最大page数
let maxPage = new Array(key.length).fill(0);

for(let i = 0; i < key.length; i++){
    for(let lang in books){
        maxPage[i] = Math.max(maxPage[i], books[lang][key[i]].length);
    }
}
// 向上取偶
maxPage.forEach((val, i)=>{
    maxPage[i] = val + val%2;
});
// 生成页码数量
writeScript(maxPage);

/**
 * 处理
 * page和lang对齐最长的，页数少的语言补空格
 * page输出最长的，lang分语言输出到对应的mc text文件中
 *  pages.txt
 *  zh_CN.lang
 *  en_US.lang
 */
let pageStr = "";
let pageExported = false;
for(let name in books){// 对每本书
    let langStr = "";
    for(let i = 0; i < 3; i++){ // 的每种语言
        // 解析
        let k = key[i];
        let book = books[name];
        let b = new Book(i);
        b.resolve(book[k]);
        b.align(maxPage[i]);
        
        // 输出
        langStr += b.exportLangs().join('\n') + '\n\n';
        if(!pageExported) pageStr += b.exportPages().join('\n') + "\n\n";
    }
    // 写入lang文件
    writeLang(name.replace('.js', ''), langStr);
    pageExported = true;
}

// 写入page文件
fs.writeFile("./output/pages.txt", pageStr, 'utf8', (err) => {
    if (err) {
        console.error('写入pages.txt文件时发生错误：', err);
        return;
    }
});
