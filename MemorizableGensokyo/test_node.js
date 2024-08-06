import { Book } from "./Book.js";
import * as zh from "./books/zh_CN.js"


let b = new Book(1);

b.resolve(zh.book3);

// b.addText("line1\nline2\n\nline3");

// 测试时输出到控制台
console.log("=========")
console.log(b.exportPages().join('\n'))
console.log("=========")
let langs = b.exportLangs();

langs.forEach((val, index)=>{
    langs[index] = val.replace(new RegExp('%1', 'g'), "\n");
})

console.log(langs.join('\n'))
console.log("=========")

// 错误报告
if(b.invalidItems.size > 0){
    console.log("无效物品:", Array.from(b.invalidItems).join('\n'));
}