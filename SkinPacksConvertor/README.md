
### 皮肤包转换器

#### 网站构建

皮肤包转换器使用 `webpack` 生成单文件网站，使用如下指令构建：

```npm run build:single```

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
- [x] 调整idle动画播放条件
- [x] 调整看玩家和beg的优先级，要高于闲逛
- [x] 完成基础的ysm直转功能，解决一些明显、容易解决且回报高的问题；
- [x] 为转换器实现两套配置：玩家转换，模板附带所有信息；默认包转换，模板仅附带手动转换的东方包
- [x] 实现内置包转换脚本，加入酒狐等内置包

- [x] 行走动画的最低速度没有改全，动作幅度也需要使用0.05作为最低速度，不然从移动到静止的过渡会比较突兀
- [x] 灵梦的眼睛会闪，看看眨眼动画是不是被改了：动画条件有问题，不播了
- [x] 表单化皮肤包配置。使用物品调出管理表单，粘贴网站给的皮肤包数据并提交。皮肤包指令不再被使用。之后的皮肤包加载均使用json结构，以传递更多信息。
- [ ] 皮肤自动变更：检测到女仆正在使用一个未注册的皮肤时，重新随机一个皮肤。触发时机需要看看现有事件，最好是女仆刚加载的时候，以后做女仆管理也是很有用的。（取名 onLoad）
- [x] 旧皮肤包检查：检查默认旧皮肤包的动画是否正常，同时也要检查旧皮肤包的转换是否正常

- [ ] 压缩动画变量，将 坐下、躺下、抱起 等boolean状态合并为一个int变量，通过位运算获取值，省下宝贵的变量空间。
  最好趁这次动画大改一起加进去，这是个兼容大坑
- [ ] 一些简单变量还是要转的，比如饥饿值，不能按通用方案设为0
  - 饥饿值`ysm.food_level`由脚本传入，默认为6不变，以后就不用改了
  - 躺下`ysm.is_sleep`，同上
- [ ] 实现一些简单动画，如 swing，
  其实最关键的是要让脚本能调用，因为农作的破坏方块实际上是没有女仆参与的，不能用普通的mc自带变量。

- [ ] 都完成后，再加个坐垫包转换，应该比较容易
- [ ] 修复刷物品bug

低优先级：
- 模型单独展示描述和作者，目前没位置放，需要确定方案
- 目前不实现覆盖默认女仆动画的逻辑，非is_gecko模型均使用默认动画
- 支持按模型包排序（支持一个压缩包含有多模型包引入的需求）
- 如果要用脚本调用动画，可能得靠指令来注册（目前没有需要脚本调用的动画），不确定是否有方便的修改实体动画参数的方法，指令动画实际上并不需要被注册在实体定义中

#### 转换流程

读取全部输入的 java 模型包，初始化动画和翻译文本资源管理器。

参考 Java 版 TouhouLittleMaid 1.20 资源加载流程：
- `CustomPackLoader.loadMaidModelPack()`：读取 maid_model.json 并 decorate
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
- `model.<name>.<model_id>.name=xxx`

> `<pack_id>` 是网页上显示的序号；
> `<model_id>` 由 maid_model.json 中的先后顺序决定


#### 导入方法

1、导入资源包并在世界中激活，令附加模型包优先级高于主包。

2、打开游戏设置面板（`/scriptevent thlm:config`），进入「皮肤包」，粘贴网站给出的 JSON 并提交。
   例如：`[{"count":20},{"count":10}]`
   数组每一项对应一个模型包，`count` 为该包中的模型数量。网页会显示该数据，并在资源包中生成 `skin_pack.json`。

#### 已知问题和注意事项

尽量不使用额外实体属性实现模型动画和语音包等功能，因为实体属性只能设32个。

jojijoji-2.0.0 maid_model.json格式有问题，需要手动创建新文件，将字符复制过来后替换旧文件。
