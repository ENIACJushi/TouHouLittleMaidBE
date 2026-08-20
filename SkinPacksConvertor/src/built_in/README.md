
## 内置包转换

执行内置包转换，并将其合并到`TouhouLittleMaid_RP`。

```
npm run convert:built-in
```

### 文件说明

- 基础模板文件：`SkinPacksConvertor/src/maid_basic.ts`
  - 仅包含手动转换的东方包和一些通用基础部件（如：背包），由开发者手动修改。
  - `TouhouLittleMaid_RP/entity/maid/maid.entity.json`、`src/convertor/config/profile/AnimationTemplates.ts` 均基于此文件生成

### 转换流程

#### 内置包转换

以内置包转换档案（USE_INNER_PACK_PROFILE=true），对 `tools/touhou_little_maid-1.0.0-bedrock` 执行转换，得到中间产物【内置包】。

#### 生物渲染定义合并

- 内置包（A）：`TLM_MaidSkinPack/entity/maid.entity.json`;
- 基础模板文件（B）：`SkinPacksConvertor/src/maid_basic.ts`;
- 目标文件：`TouhouLittleMaid_RP/entity/maid/maid.entity.json`、`SkinPacksConvertor/src/convertor/config/profile/maid.entity.json`;

将内置包文件（A）和基础模板包文件（B）合并，然后覆写目标文件，json属性合并规则如下：
- 使用基础模板包文件（B）：identifier、materials、spawn_egg
- 使用内置包文件（A）：scripts、animations、render_controllers
- 二者合并：textures、geometry

合并完成后，将结果覆写到两个目标文件。

#### 资源迁移

- `TLM_MaidSkinPack/animations`：迁移到 `TouHouLittleMaid_RP/animations/built_in_skins`，这个文件夹专门为内置包准备，若已有文件，则先全部删除
- `TLM_MaidSkinPack/entity`：这个文件比较特殊，见章节【生物渲染定义合并】
- `TLM_MaidSkinPack/models/entity`：将目录下的文件夹迁移至 `TouHouLittleMaid_RP/models/entity/built_in_skins`，这个文件夹专门为内置包准备，若已有文件，则先全部删除
- `TLM_MaidSkinPack/textures`：将目录下的文件夹迁移至 `TouHouLittleMaid_RP/textures`，除 `TLM_MaidSkinPack/textures/thlm` 以外，其它 `TLM_MaidSkinPack/textures` 下的文件夹均采用先删除目标文件夹内的全部文件，再迁移的方式
- `TLM_MaidSkinPack/render_controllers/maid.json`：覆写 `TouHouLittleMaid_RP/render_controllers/maid/built_in_skins.json`
- `TLM_MaidSkinPack/texts`：
  - 对于 `xxx.lang` 文件，将其内容全部追加到 `TouHouLittleMaid_RP/texts` 的同名文件上。首尾用 `##### BUILT_IN_SKINS_START #####` 和 `##### BUILT_IN_SKINS_END #####` 两行标签标记，如果在追加前找到了这两个标记，则先删除这两个标记之间的内容，然后在这两个标记之间追加。
  - 对于 `languages.json`，将 `TouHouLittleMaid_RP/texts/languages.json` 没有的值追加上去
