
### 皮肤包转换器

皮肤包转换器使用 `webpack` 生成单文件网站，使用如下指令构建：

```npm run build:single```

尽量不使用额外实体属性实现模型动画和语音包等功能，因为实体属性只能设32个。

#### 计划

- 核心目标：支持动画解析
  - 解析动画文件索引 √
  - 将动画信息加到实体定义里
  - 生成动画调用参数（已确定格式）
- 考虑取消sit等动画的动画控制器，实现动画转换的统一，并且过渡动画对一些动画来说是多余的，
  比如汉服酒狐的坐下动画，长裙是通过缩小动画隐藏的
- 缩放。实际上和动画的关联非常高
- 彩蛋。对于酒狐来说比较重要，因为有狐形态

低优先级：
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

1、导入资源包

2、输入指令
   /scriptevent thlm:set_pack 100,10,23
      由 1 开始的模型包中模型的数量。网页会给出指令，并在资源包里生成一个文件。
      按一个包占 4 位计算，512个包才会超出指令字符限制，所以不考虑包过多的情况。

#### 已知问题

   jojijoji-2.0.0 maid_model.json格式有问题，需要手动创建新文件，将字符复制过来后替换旧文件。
