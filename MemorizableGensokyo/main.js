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

const fs = require('fs');
const path = require('path');

// 定义文件路径
const filePathA = path.join(__dirname, 'a.json');
const filePathB = path.join(__dirname, 'b.json');

// 读取a.json文件
fs.readFile(filePathA, 'utf8', (err, data) => {
    if (err) {
        console.error('读取a.json文件时发生错误：', err);
        return;
    }

    // 将读取到的数据写入到b.json文件中
    fs.writeFile(filePathB, data, 'utf8', (err) => {
        if (err) {
            console.error('写入b.json文件时发生错误：', err);
            return;
        }
        
        console.log('文件写入成功，b.json已创建并包含a.json的内容。');
    });
});