
### 皮肤包转换器

#### 网站构建

皮肤包转换器使用 `webpack` 生成单文件网站，使用如下指令构建：

```npm run build:single```

附加包产物与主包一致，自带 `subpacks`：
- 根目录：完整内置底板 + 本次模型
- `subpacks/simple`：精简内置底板 + 本次模型（对齐主包「精简」子包）
- `subpacks/full`：空占位，默认选用根目录完整定义

#### 测试

需要先配置环境变量 `MinecraftPath`，用于将生成结果自动覆盖到 `development_resource_packs`，如：

```
C:\Users\xxx\AppData\Roaming\Minecraft Bedrock\Users\Shared\games\com.mojang
```

**使用如下指令快速得到测试包：**

```
// 基础构建
npm run test:convert
// 带参数
npm run test:convert --move --uuid=你的-uuid
```

参数：
- `--move`/`--m`：自动安装到 development_resource_packs（需要配置环境变量 MinecraftPath）
- `--uuid=xxx`/`--u=xxx`：指定生成包的 uuid

**使用如下指令执行内置包转换并覆盖到 `development_resource_packs`：**

```
npm run test:built_in
```

#### 内置包构建

使用如下指令执行内置包转换，并将其合并到`TouhouLittleMaid_RP`：

```
npm run convert:built-in
```

流程说明见 `src/built_in/README.md`。


#### 计划

版本发布前：


- [ ] 塞点私货（作者模型（？））
- [ ] 实现一些简单动画，如 swing，
  其实最关键的是要让脚本能调用，因为农作的破坏方块实际上是没有女仆参与的，不能用普通的mc自带变量。

低优先级：
- 模型单独展示描述和作者，目前没位置放，需要确定方案
- 目前不实现覆盖默认女仆动画的逻辑，非is_gecko模型均使用默认动画
- 支持按模型包排序（支持一个压缩包含有多模型包引入的需求）
- 如果要用脚本调用动画，可能得靠指令来注册（目前没有需要脚本调用的动画），不确定是否有方便的修改实体动画参数的方法，指令动画实际上并不需要被注册在实体定义中

#### 转换流程

读取全部输入的 java 模型包，初始化动画和翻译文本资源管理器。

参考 Java 版 TouhouLittleMaid 1.20 资源加载流程：
- `CustomPackLoader.loadMaidModelPack()`：读取 maid_model.json 并 decorate
- `CustomModelPack.decorate()`：补全缺省字段后，将 `extra_textures` 拆成同模型多贴图条目（派生 `model_id` 后缀为贴图 path 的 MD5）
- `CustomPackLoader.loadGeckoMaidModelElement()`：解析 model/texture/animation 路径并加载文件
- `GeckoModelLoader.mergeAnimationFile()`：按顺序合并动画 JSON
  参考位置：`TouhouLittleMaid-1.20/.../CustomPackLoader.java`、`GeckoModelLoader.java`

**动画转换流程**
- 逐个解析模型信息，记录各个动画的 `模型包seq、模型seq - 动画编号`
- 遇到未解析的动画，则进行解析，并加入缓存表（极端条件会导致动画名冲突，在导出时，若发现重名动画，则执行重命名）
- 完成所有模型包的解析后，执行导出：
  - 将原 json 动画文件的固定动画名转换为基岩版的唯一动画名；<namespace>.<文件名（去路径及.json）>.<type>
  - 将动画注册到 animations，生成唯一编号;
  - 将动画注册到 scripts - animate，使用动画变量 `v.animate_xxx = n` 控制展示;
  - 汇总所有的动画展示条件，输出到 scripts - pre_animation
  - 解析 tameable_can_ride，决定是否可坐

#### 目录对应

`<name>`：命名空间，由文件夹 `assets/<name>` 指定

**Java 版模型包**
- [x] 1、`pack.png`（模型包图标）
- [x] 2、`pack.mcmeta`（模型包信息）
- [x] 3、`assets/<name>/`
- [x] 4、`maid_model.json`（模型信息）
- [x] 5、`models/`（女仆模型）
- [x] 6、`textures/entity`（女仆贴图）
- [x] 7、`textures/maid_icon.png`（女仆图标）
- [x] 8、`lang/`（语言文件）


**基岩版模型包**

- [x] 1、`pack_icon.icon`：模型包主图标，显示在世界资源包页面
- [x] 2、`manifest.json`：模型包信息，自动生成
- [x] 3、`entity/maid.entity.json`：模型信息，整个资源包仅此一份，包含所有模型和材质的定义，对应 `4`
- [x] 4、`render_controllers/maid.json`：渲染方案，整个资源包仅此一份，但是其内部的定义是每个模型包一个，对应 `4`
- [x] 5、`texts/`：语言文件，对应 `8`
- [x] 6、`models/entity/<name>/`：女仆模型，对应 `5`, `models/entity` 是固定的，其它文件夹无法被识别
- [x] 7、`textures/`：贴图。
- [x] 8、`<name>/entity`：女仆贴图，对应 `6`
- [x] 9、`thlm/maid_pack_<i>.png`：模型包图标，在选择模型时显示，对应 `1`

**迁移方案**

1、模型包图标：改名并移动；
2、模型包信息：这里包含的信息比较少，不会带到基岩版模型包中；
4、
5、转换格式后一并放入 models/entity/<name>/
6、一并放入 textures/<name>/
7、女仆图标：改名并移动；
8、修改文件名后放入 lang/

#### 语言文件

**Java 版语言文件格式**

- `maid_pack.<name>.name=xxx`：模型包名称
- `maid_pack.<name>.desc=xxx`：模型包描述
- `model.<name>.<model>.name=xxx`：模型名称
 
**基岩版语言文件格式**

- `maid_pack.<pack_id>.name=xxx`
- `maid_pack.<pack_id>.desc=xxx`
- `maid_pack.<pack_id>.authors=xxx`
- `tlm.maid.model.<pack_id>.<model_seq>.name=xxx`
- `tlm.maid.model.<pack_id>.<model_seq>.desc=xxx`

坐垫对齐格式：

- `chair_pack.<pack_id>.*`
- `tlm.chair.model.<pack_id>.<model_seq>.*`

> `<pack_id>` 是网页上显示的序号（内置包从手动东方包 0 起）；
> `<model_seq>` 由 maid_model.json 展开（含 extra_textures）后的先后顺序决定。


#### 导入方法

1、导入资源包并在世界中激活，令附加模型包优先级高于主包。

2、创造模式下使用物品「记忆中的幻想乡（管理）」打开管理面板（也可 `/scriptevent thlm:manage`），进入「皮肤包」，粘贴网站给出的 JSON（或资源包内 `command.txt`）并提交。
   例如：`{"skin":[{"count":20}],"chair":[{"count":10}]}`
   `skin` / `chair` 数组每一项对应一个模型包，`count` 为该包中的模型数量。网页展示与资源包内 `command.txt` 内容一致。

#### 已知问题和注意事项

尽量不使用额外实体属性实现模型动画和语音包等功能，因为实体属性只能设32个。

jojijoji-2.0.0 maid_model.json格式有问题，需要手动创建新文件，将字符复制过来后替换旧文件。
