
## 记忆中的幻想乡 ~ Memorizable Gensokyo

模组指南书生成工具。

### 一键生成

1、运行 `main.js`，需要完整的项目文件，和 NodeJs 运行环境
  ```
  node main.js
  ```

*翻译文件，如 `zh_CN.lang` 会自动输出到资源包的文件中
*若页数有变化，新的页数会自动输出到 `TouHouLittleMaid_BP/typescripts/src/book/MemorizableGensokyoUI.js` 中

### 配置指南

#### font 文件更换

font 可能会和其他模组发生冲突，可修改 `Book.js` 中，下面两个配置项的值，使用其他 font 文件：

```
const GLYPH_IMG = 0xE500; // 大号图片，对应 `TouHouLittleMaid_RP/font/glyph_E5.png`
const GLYPH_ITEM = 0xE600; // 物品图片，对应 `TouHouLittleMaid_RP/font/glyph_E6.png`
```

然后同步修改资源包中对应 png 文件的名称即可。如：

```
const GLYPH_IMG = 0xD500; // 大号图片，对应 `TouHouLittleMaid_RP/font/glyph_D5.png`
                    ^^                                                   ^^
                 E5 -> D5                                      同步修改资源包的文件名
```

#### 翻译文字

在 `./books/` 提供原始书籍文字即可，运行 `main.js` 时会自动识别该目录下的文件。
若要添加新语言，文件名需要和目标的 lang 文件同名。如 `zh_CN.js` 对应 `zh_CN.lang`。
