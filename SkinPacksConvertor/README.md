
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
- [x] 皮肤自动变更：检测到女仆正在使用一个未注册的皮肤时，重新随机一个皮肤。触发时机需要看看现有事件，最好是女仆刚加载的时候，以后做女仆管理也是很有用的。（取名 onLoad）
- [x] 旧皮肤包检查：检查默认旧皮肤包的动画是否正常，同时也要检查旧皮肤包的转换是否正常
- [x] 压缩动画变量，将 坐下、躺下、抱起 等boolean状态合并为一个int变量，通过位运算获取值，省下宝贵的变量空间。
- [x] 一些简单变量还是要转的，比如饥饿值，不能按通用方案设为0
  - 饥饿值`ysm.food_level`由脚本传入，默认为20不变，以后就不用改了（可以使用小酒狐验证）
  - 躺下`ysm.is_sleep`，同上

- [ ] 支持坐垫包
  - [x] 坐垫模型的名称形如 `model.touhou_little_maid.cushion.name`，在解析里使用它，并修改BP/typescript使用的名称
  - [x] 坐垫的built_in转换模式也要参照女仆的built_in模式，转换后将生物定义作为普通转换的模板，并且模型包的起始编号不同
  - [x] 鸟居2和鸟居3没贴图: 解析 texture 属性，
  - [x] 模型位置偏高：实体生成的位置高了
  - [x] 使用物品 "touhou_little_maid:chair" 放置，放置由脚本处理，规则为：
    - 潜行放置时，实体精准生成在玩家点击的位置，并面向玩家
    - 非潜行放置时：
      - 实体只会朝向八个方向：x+、x-、z+、z-，以及它们之间的45度角，根据玩家朝向确定
      - 若点击的是方块上表面，则实体生成在玩家点击的方块的上表面中央，高度为玩家触点的高度
      - 若点击的是方块侧面，则取该侧面紧贴的方块的底面中央
      - 若点击的是方块下表面，则实体生成在点击方块之下的方块底面中央
  - [x] 收回逻辑：潜行攻击收回，有模型包记忆功能，放下的坐垫被回收后会记录使用的模型，重新放置会保持模型
  - [x] 给内置模型包解析（built_in）增加顺序配置功能，有配置顺序的包按序放在最前，没配置的放在有配置的包之后
    - 配置：`src/built_in/packOrder.ts` → `BUILTIN_PACK_DOMAIN_ORDER`
  - [x] 隐藏实体阴影（末影水晶标识符 - 最终在阴影和防水之间选择了阴影）
  - [x] 实体不要随玩家转动
  - [x] 坐垫实体继承了之前的离开就自动清空，这次不需要这个了
  - [x] 碰撞箱显隐机制暂时不加，因为末影水晶的runtime隐藏不掉实体阴影
  - [x] 补充离屏渲染
  - [x] 末影水晶没有实体角度，需要用动画来实现旋转
  - [x] 名字改成坐垫
  - [x] 补充骑乘文本
  - [x] 执行built_in构建时，自动修改BP/typescript的内置椅子包数据（不需要自动编译BP/typescript）
  - [x] 取消坐垫的末影水晶标识符，使用一般实现
  - [x] 添加模型显示工具实现坐垫模型展示机制：
    - 手持检测使用和御币一样的，并放在一起。如果前缀（命名空间）不一样就把坐垫模型显示物品改成和御币一样的
    - 手持模型显示物品时，使附近10格的坐垫进入碰撞箱展示状态，添加展示状态的 component_groups
    - 展示状态时的恢复检测由json定义实现，参考女仆展示物品栏图标的逻辑，用json定义来检测附近是否有符合条件的玩家，若没有则自动恢复
  - [x] 塞钱箱渲染错误：模型的贴图尺寸数据是字符串
  - [x] 更换坐垫贴图
  - [x] 添加坐垫合成表
  - [x] 不要分两个文件导出皮肤包和坐垫的数据，导出单个command.txt就行，和网站展示的一致
  - [x] 添加坐垫高度解析 mounted_height
  - [x] 因为有精准高度计算，暂时不添加坐垫无重力解析 no_gravity
  - [x] 记忆中的幻想乡补充坐垫相关信息

- [x] 网站的数据栏增加一个复制按钮，并调整UI，使其可以自动换行和滚动查看
- [ ] 支持解析单模型对应多贴图
- [ ] 调整女仆模型包的lang key 格式，需要同步修改手动修改的东方包
- [ ] 加载有点慢，看看是不是报错多了
- [ ] 修复刷物品bug
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
- `model.<name>.<model_id>.name=xxx`

> `<pack_id>` 是网页上显示的序号；
> `<model_id>` 由 maid_model.json 中的先后顺序决定


#### 导入方法

1、导入资源包并在世界中激活，令附加模型包优先级高于主包。

2、创造模式下使用物品「记忆中的幻想乡（管理）」打开管理面板（也可 `/scriptevent thlm:manage`），进入「皮肤包」，粘贴网站给出的 JSON（或资源包内 `command.txt`）并提交。
   例如：`{"skin":[{"count":20}],"chair":[{"count":10}]}`
   `skin` / `chair` 数组每一项对应一个模型包，`count` 为该包中的模型数量。网页展示与资源包内 `command.txt` 内容一致。

#### 已知问题和注意事项

尽量不使用额外实体属性实现模型动画和语音包等功能，因为实体属性只能设32个。

jojijoji-2.0.0 maid_model.json格式有问题，需要手动创建新文件，将字符复制过来后替换旧文件。
