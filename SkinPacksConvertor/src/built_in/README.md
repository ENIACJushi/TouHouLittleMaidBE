
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

#### 精简子资源包（Bedrock `subpacks`）

在完整转换之后，再用 `src/built_in/subpack_simple/geckolib_maid_model.json`
（geckolib 仅保留 `model_list` 第一个模型）覆盖源包中的
`assets/geckolib/maid_model.json`，做第二次转换。

产物写入 `TouHouLittleMaid_RP/subpacks/`（由 `manifest.json` 的 `subpacks` 声明，可在游戏资源包齿轮里切换）：

| folder_name | memory_tier | 内容 |
|-------------|-------------|------|
| `simple` | 0 | 精简女仆实体定义 + 配套 `tlm_pack_maid.animation.json` + `built_in_skins` 渲染控制器 |
| `full` | 1 | 空占位；默认选用此档时无覆盖 → 使用根目录完整定义 |

说明：
- 精简转换的动画编号与完整包不同，故子包内必须自带动画/RC，不能只覆写实体。
- 模型与贴图仍用根目录完整资源（精简实体只引用其中子集）。
- 参考：[Building Sub-Packs](https://learn.microsoft.com/minecraft/creator/documents/buildingsubpacks)、[Bedrock Wiki · Subpacks](https://wiki.bedrock.dev/concepts/subpacks)

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
- `TLM_MaidSkinPack/textures`：将目录下的文件夹迁移至 `TouHouLittleMaid_RP/textures`
  - `TLM_MaidSkinPack/textures/thlm`：将其中文件合并到 `TouHouLittleMaid_RP/textures/thlm`，已有同名文件则覆盖，目标中多出来的文件保留
  - 其它文件夹：先删除目标文件夹内的全部文件，再迁移
- `TLM_MaidSkinPack/render_controllers/maid.json`：覆写 `TouHouLittleMaid_RP/render_controllers/maid/built_in_skins.json`
- `TLM_MaidSkinPack/texts`：
  - 对于 `xxx.lang` 文件，将其内容全部追加到 `TouHouLittleMaid_RP/texts` 的同名文件上。首尾用 `##### BUILT_IN_SKINS_START #####` 和 `##### BUILT_IN_SKINS_END #####` 两行标签标记，如果在追加前找到了这两个标记，则先删除这两个标记之间的内容，然后在这两个标记之间追加。
  - 对于 `languages.json`，将 `TouHouLittleMaid_RP/texts/languages.json` 没有的值追加上去

#### BP 内置女仆 / 坐垫包数据同步

转换与资源迁移完成后，按 lang 合并同样的标签块方式，覆写：

1. **女仆** — `TouHouLittleMaid_BP/typescripts/src/maid/skin/MaidSkin.ts` 中
   `// ##### BUILT_IN_MAID_PACKS_START #####` … `// ##### BUILT_IN_MAID_PACKS_END #####`
   之间的 `BUILT_IN_MAID_DEFAULT_PACKS`（各自动转换包的模型数量）。
   **手动转换的东方包**（`MANUAL_BUILT_IN_MAID_DEFAULT_PACKS`，pack 0）在标签外，不会被改写。

2. **坐垫** — `TouHouLittleMaid_BP/typescripts/src/chair/skin/ChairSkin.ts` 中
   `// ##### BUILT_IN_CHAIR_PACKS_START #####` … `// ##### BUILT_IN_CHAIR_PACKS_END #####`
   以及高度标签块之间的 `BUILT_IN_CHAIR_DEFAULT_PACKS` / `BUILT_IN_CHAIR_DEFAULT_HEIGHTS`
   （包数量与各模型 `mounted_height` 像素列表）。

仅改源码，**不会**自动编译 BP。实现见 `src/built_in/syncMaidDefaultPacks.ts`、`src/built_in/syncChairDefaultPacks.ts`。

#### 子包解析顺序

配置文件：`src/built_in/packOrder.ts` 中的 `BUILTIN_PACK_DOMAIN_ORDER`。

规则：
- 数组中的 domain（`assets/<domain>`）按声明顺序优先分配女仆 / 坐垫 packId
- 未出现在配置中的子包排在所有已配置包之后，并保持彼此相对顺序
- 网页附加包转换不使用此配置（`PACK_DOMAIN_ORDER` 为空）

调整顺序后，执行 `npm run convert:built-in` 会自动覆写 BP 侧上述女仆 / 坐垫内置常量（不触发 typescript 编译）。
