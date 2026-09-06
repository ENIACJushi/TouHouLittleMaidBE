# 未转换 Molang 变量清单：`tlm.*` / `ysm.*` / `ctrl.*`

> 对照源：  
> - Java：`.ref/TouhouLittleMaid-1.20`（绑定注册于 `GeckoLibCache` → `TLMBinding` / `YSMBinding` / `CtrlBinding`）  
> - 皮肤包动画：`.ref/touhou_little_maid-1.0.0` + `SkinPacksConvertor/tools`  
> - 转换器：`SkinPacksConvertor/src/convertor/config/MolangConvertRules.ts`、`molang/tlm|ysm/*Resolvers.ts`  
>
> 统计口径：官方示例皮肤包 JSON 中出现的前缀字段（函数名按 `ysm.second_order` / `ysm.bone_rot` 计一次调用族）。

---

## 0. 总览

### 0.1 绑定入口（Java）

| 命名空间 | 注册位置 | 实现类 |
|----------|----------|--------|
| `ysm` | `geckolib3/resource/GeckoLibCache.java` → `EXTRA_BINDING.put("ysm", …)` | `client/animation/gecko/molang/YSMBinding.java` |
| `tlm` | 同上 | `client/animation/gecko/molang/TLMBinding.java` |
| `ctrl` | 同上 | `client/animation/gecko/molang/CtrlBinding.java`（Immersive Melodies 兼容） |

### 0.2 转换器现状

| 前缀 | 已适配规则（`MolangConvertRules.ts`） | 未命中时行为 |
|------|----------------------------------------|--------------|
| `tlm.*` | `has_backpack`、`is_sitting` | `fallbackVariableValue` → `0` / `1`（乘除语境）或取 `??` 右值；并 `writeErrorLog` |
| `ysm.*` | `is_close_eyes`、`head_pitch`、`head_yaw` | 同上（日志默认注释掉） |
| `ctrl.*` | 无 | 若出现会按未知前缀处理（官方包未使用） |

### 0.3 官方包实际出现 vs 已转换

| 变量 / 函数 | 约出现次数 | 转换状态 | 当前兜底后果（重要） |
|-------------|------------|----------|----------------------|
| `ysm.head_yaw` | ~5700 | ✅ 已转换 | — |
| `ysm.head_pitch` | ~5300 | ✅ 已转换 | — |
| `ysm.has_mainhand` | ~1300 | ❌ 未转换 | → `0`，持物姿态几乎不触发 |
| `ysm.food_level` | ~1250 | ❌ 未转换 | → `0`，`0<=6` **恒真**，饥饿姿态常开 |
| `ysm.input_vertical` | ~500 | ❌ 未转换 | → `0`，倒退/前进相关摆动失效 |
| `ysm.second_order(...)` | ~300 | ❌ 未转换 | 整段调用被兜底成常数，弹簧失效 |
| `ysm.bone_rot(...).x/z` | ~200 | ❌ 未转换 | → `0`，依赖他骨旋转的联动失效 |
| `tlm.is_sitting` | ~96 | ✅ 已转换 | — |
| `ysm.has_offhand` | ~68 | ❌ 未转换 | → `0` |
| `ysm.is_close_eyes` | ~46 | ✅ 已转换 | — |
| `ysm.has_helmet` | ~34 | ❌ 未转换 | → `0` |
| `tlm.has_backpack` | ~6 | ✅ 已转换 | — |
| `ysm.input_horizontal` | ~4 | ❌ 未转换 | → `0` |
| `ysm.has_elytra` | ~2 | ❌ 未转换 | → `0` |

> 转换后输出里大量的 `animation.tlm.skin_pack.*` **不是** Molang 变量，而是转换器生成的动画名，可忽略。

---

## 1. 已转换（对照，便于差集）

### 1.1 `tlm.has_backpack`

| 项 | 内容 |
|----|------|
| **用途** | 是否装备女仆背包；驱动背包显示/隐藏骨骼缩放等 |
| **Java 解析** | `TLMBinding` → `maidEntityVar("has_backpack", ctx -> ctx.entity().hasBackpack())`；实体侧 `IMaid.hasBackpack()` / `EntityMaid` 背包组件 |
| **基岩适配（已做）** | `(q.property('thlm:backpack_type')!=0)` |
| **备注** | 属性已在 `TouHouLittleMaid_BP/entities/maid/maid.json` 的 `thlm:backpack_type` |

### 1.2 `tlm.is_sitting`

| 项 | 内容 |
|----|------|
| **用途** | 女仆坐下姿态；影响 sit/walk/idle 动画与部分条件姿态 |
| **Java 解析** | `TLMBinding` → `isMaidInSittingPose()`（`EntityMaid` / `IMaid`） |
| **基岩适配（已做）** | → `v.tlm_is_sitting`；在 `AnimationTemplates.pre_animation` 中：`v.tlm_is_sitting = query.property('thlm:is_sitting')` |

### 1.3 `ysm.head_pitch` / `ysm.head_yaw`

| 项 | 内容 |
|----|------|
| **用途** | 头部俯仰 / 偏航（度），驱动看向、头发、瞳孔等 |
| **Java 解析** | `YSMBinding`：`var("head_yaw", ctx -> ctx.data().netHeadYaw)`、`var("head_pitch", ctx -> ctx.data().headPitch)` |
| **基岩适配（已做）** | pitch：`(-query.target_x_rotation)`（符号对齐 YSM）；yaw：旋转用 `math.clamp(query.target_y_rotation,-80,80)`，position 通道用取反并夹到 ±30 的瞳孔专用值 |

### 1.4 `ysm.is_close_eyes`

| 项 | 内容 |
|----|------|
| **用途** | 闭眼状态（睡觉或周期性眨眼） |
| **Java 解析** | `YSMBinding.getEyeCloseState`：`(tick+uuid)%90` 落在 85–90，或 `isSleeping()` |
| **基岩适配（已做）** | → `v.ysm_is_close_eyes`；`pre_animation` 用 `life_time` + 随机间隔模拟眨眼 |

---

## 2. 未转换且官方包在用（优先）

下列按 **优先级 = 出现频率 × 视觉影响** 排序。

---

### 2.1 `ysm.has_mainhand` / `ysm.has_offhand` ⭐⭐⭐

| 项 | 内容 |
|----|------|
| **用途** | 主手/副手是否持有物品。常见于手臂休息角、持物偏移（如 `ysm.has_mainhand?30:0`、`ysm.has_mainhand?0:-7.51`） |
| **出现** | mainhand ~1296；offhand ~68 |
| **Java 解析** | `YSMBinding`：`livingEntityVar("has_mainhand/offhand", getSlotValue(..., MAINHAND/OFFHAND))` → 槽位 `ItemStack` 非空 |
| **实现文件** | `YSMBinding.java` L62–63；`EquipmentUtil.getEquippedItem` |
| **当前转换** | 无规则 → 常数 `0` → **永远当作空手** |
| **推荐适配** | |
| 方案 A（推荐） | 替换为基岩装备查询：<br>`ysm.has_mainhand` → `query.is_item_equipped('slot.weapon.mainhand')`<br>`ysm.has_offhand` → `query.is_item_equipped('slot.weapon.offhand')`<br>（若目标引擎版本无 `is_item_equipped`，改用脚本同步布尔 property） |
| 方案 B | BP 脚本每帧写 `thlm:has_mainhand` / `thlm:has_offhand`，RP 读 `q.property(...)`（与现有 `thlm:*` 风格一致，兼容性最好） |
| **规则草稿** | `{name:'has_mainhand', type:'replace', value:"query.is_item_equipped('slot.weapon.mainhand')"}` 等同理 offhand |

---

### 2.2 `ysm.food_level` ⭐⭐⭐（当前有错误语义）

| 项 | 内容 |
|----|------|
| **用途** | 女仆饥饿值（0–20 量级）。皮肤用 `ysm.food_level<=6` / `<6` 切换「饿瘪」姿态（手臂下垂、肚子缩放等） |
| **出现** | ~1246 |
| **Java 解析** | `YSMBinding.getFoodLevel`：读属性 `InitAttribute.MAID_HUNGER`（默认 20）；实体 `EntityMaid.getHunger()` / NBT `MaidHunger` |
| **实现文件** | `YSMBinding.java` L105、L114–120；`InitAttribute.java`；`EntityMaid.java` hunger API |
| **当前转换** | → `0`，表达式变成 `0<=6?...` **恒为真** → 饥饿姿态常驻（比「不触发」更糟） |
| **推荐适配** | |
| 方案 A（推荐） | BP 增加同步属性 `thlm:hunger`（int 0–20+），脚本从女仆饥饿同步；规则：`ysm.food_level` → `q.property('thlm:hunger')` |
| 方案 B（临时止血） | 先替换为常数 `20`（永不饿），避免错误常开；再补属性 |
| **注意** | 基岩没有原版玩家式 `query.food_level` 可直接套给自定义实体，必须自建 property 或 script |

---

### 2.3 `ysm.input_vertical` / `ysm.input_horizontal` ⭐⭐

| 项 | 内容 |
|----|------|
| **用途** | 相对实体朝向的水平移动分量：前进/后退 ≈ cos(相对角)，左右 ≈ sin(相对角)。用于披风/裙摆/尾巴随「倒退」「侧移」偏转 |
| **出现** | vertical ~512；horizontal ~4（常嵌在 `second_order` 参数里） |
| **Java 解析** | `MoveInputVariable.getVertical/getHorizontal`：用位置差分算移动角，再与 `viewYRot` 作差，取 cos/sin |
| **实现文件** | `client/animation/gecko/molang/variable/MoveInputVariable.java` |
| **当前转换** | → `0`，倒退判定（如 `ysm.input_vertical<-0.05`）失效 |
| **推荐适配** | |
| 方案 A | BP/脚本用速度向量与 body yaw 算相对分量，写入 `thlm:input_vertical` / `thlm:input_horizontal`（float），Molang 读 property |
| 方案 B（近似） | `input_vertical ≈ math.clamp(query.ground_speed, 0, 1)`（仅前进幅度，无倒退符号）；horizontal 暂 `0`。适合「动起来就有摆动」的低成本方案 |
| 方案 C | 在 `pre_animation` 用位置差分自积（需 `v.prev_x` 等），纯 RP 难做准，不推荐作主方案 |

---

### 2.4 `ysm.second_order(key, input, freq?, damp?, response?)` ⭐⭐⭐

| 项 | 内容 |
|----|------|
| **用途** | YSM 二阶弹簧/阻尼跟随（参考 Procedural Animation 视频）。按字符串 `key` 在实体物理管理器中保持状态，每帧更新后返回平滑输出。用于头发防穿模、鞘翅 yaw、胸部/尾巴跟随、无人机位姿等 |
| **签名** | 至少 2 参：`(key, input)`；可选 `frequency`(默认1)、`coefficient`(默认1)、`response`(默认1) |
| **出现** | ~302 次调用 |
| **Java 解析** | `SecondOrderFunction` → `PhysicsManager` 取/建 `SecondOrder`；`update(dt)` 做阻尼积分 |
| **实现文件** | `functions/SecondOrderFunction.java`；`functions/physics/SecondOrder.java`；`PhysicsManager.java` |
| **当前转换** | 多段表达式 `ysm.second_order(...).…` 走兜底 → 常数，**动态跟随全部丢失** |
| **推荐适配** | |
| 方案 A（高质量） | 转换期把每次 `ysm.second_order('唯一key', input, f, c, r)` **展开**为与酒狐摇尾类似的 `v.*` 状态机：在 `extractedScripts`/`pre_animation` 中按固定 dt 积分，骨骼通道读 `v.so_<hash>_x`。需：<br>1) 解析函数实参；<br>2) 按 key 生成稳定变量名；<br>3) `initialize` 置 0；<br>4) 勿每帧清零（参见 `docs/gecko-tail-physics-bedrock.md`） |
| 方案 B（中质量） | 一阶近似：`v.out = v.out + (input - v.out) * k`（对应 `ysm.first_order` 思路），实现简单，高频抖动会差一些 |
| 方案 C（低质量止血） | 直接替换为第 2 个参数 `input`（无平滑），至少方向正确 |
| **关联** | 同文件还注册了 `ysm.first_order`（官方示例包统计未直接出现，但应一并设计） |

---

### 2.5 `ysm.bone_rot(boneName).x/.y/.z` ⭐⭐

| 项 | 内容 |
|----|------|
| **用途** | 读取当前动画处理器中某骨骼的旋转（度），再驱动其它骨骼（常见 `leftm1` 等机械/披风联动） |
| **出现** | ~200（多为 `.x` / `.z`） |
| **Java 解析** | `BoneRotation` ← `BoneParamFunction`：`getBone(name)` → 返回 `Vec3fStruct`；x/y 取负度数，z 正度数 |
| **实现文件** | `functions/BoneRotation.java`、`BoneParamFunction.java`、`struct/Vec3fStruct.java` |
| **当前转换** | 多段 → 兜底 `0` |
| **推荐适配** | |
| 方案 A | 基岩 Molang **通常不能**在表达式里安全读任意他骨当前姿态；优先在作者侧改为「同一通道内相对表达式」或合并骨骼 |
| 方案 B | 转换器静态分析：若 `bone_rot('A').x` 仅依赖关键帧常数，可内联；动态叠加则难 |
| 方案 C（实用） | 整段替换为 `0` 并记录警告（现状），或对已知模型做白名单手工映射表 |
| **同族未在包中出现但已注册** | `ysm.bone_pos`、`ysm.bone_scale`（见 §3） |

---

### 2.6 `ysm.has_helmet` ⭐

| 项 | 内容 |
|----|------|
| **用途** | 头甲是否非空；控制帽子/头发压缩等 |
| **出现** | ~34 |
| **Java 解析** | `getSlotValue(..., HEAD)` |
| **推荐适配** | `query.is_item_equipped('slot.armor.head')` 或 `thlm:has_helmet` property |

---

### 2.7 `ysm.has_elytra` ⭐

| 项 | 内容 |
|----|------|
| **用途** | 是否装备鞘翅（Java 用专用 API，不只看胸甲槽） |
| **出现** | ~2 |
| **Java 解析** | `!EquipmentUtil.getEquippedElytraItem(entity).isEmpty()` |
| **推荐适配** | 检测胸甲/鞘翅槽物品 id 是否为 `minecraft:elytra`：`q.is_item_name_any('slot.armor.chest', 0, 'minecraft:elytra')`；或脚本同步 `thlm:has_elytra` |

---

## 3. Java 已注册、官方示例包未使用（仍建议建规则，防第三方皮肤）

来源：`YSMBinding` 构造函数全文。未命中时第三方包会静默变成 `0/1`。

### 3.1 `tlm` 命名空间

| 变量 | 用途 | Java 位置 | 建议基岩适配 |
|------|------|-----------|--------------|
| `tlm.is_begging` | 索取/卖萌状态 | `TLMBinding` → `EntityMaid.isBegging()`；动画侧 `AnimationManager` 也会判 beg | 基岩已有 `query.is_interested` 驱动 beg 动画；可替换为 `query.is_interested`，或新增 `thlm:is_begging` |

### 3.2 `ysm` 函数

| 函数 | 用途 | Java 位置 | 建议适配 |
|------|------|-----------|----------|
| `ysm.mod_version(modId)` | 返回模组版本字符串 | `functions/ModVersion.java` | 基岩无意义 → 空串/`0`，或删除条件分支 |
| `ysm.equipped_enchantment_level(slot, enchId)` | 装备附魔等级 | `EquippedEnchantmentLevel.java` | 难：无通用附魔 query → 固定 `0` 或脚本查容器 |
| `ysm.effect_level(effectId)` | 药水效果等级（amplifier+1） | `EffectLevel.java` | 基岩实体效果 query 有限 → 多数字 `0`；必要时 script |
| `ysm.relative_block_name(dx,dy,dz)` | 相对方块 registry名 | `RelativeBlockName.java` | 需 script/`getBlock`；动画里少见可恒 `''`/`0` |
| `ysm.bone_pos(name)` | 骨骼位移 vec | `BonePosition.java` | 同 `bone_rot`，基岩难读他骨 |
| `ysm.bone_scale(name)` | 骨骼缩放 vec | `BoneScale.java` | 同上 |
| `ysm.first_order(key, input, response?)` | 一阶平滑 | `FirstOrderFunction.java` / `FirstOrder.java` | 与 `second_order` 同一套状态机展开，或 `lerp` 近似 |
| `ysm.dump_equipped_item` / `dump_relative_block` / `bone_pivot_abs` | YSM 对齐空实现，防报错 | `EmptyFunction` | 保持空/`0` |

### 3.3 `ysm` 变量（环境 / 实体状态）

| 变量 | 用途 | Java 要点 | 建议基岩适配 |
|------|------|-----------|--------------|
| `ysm.weather` | 0晴/1雨/2雷 | `ClientLevel.isRaining/isThundering` | 已有 `environment:weather` property → `q.property('environment:weather')`（确认枚举一致） |
| `ysm.dimension_name` | 维度 id 字符串 | `level.dimension().location()` | 字符串比较在基岩动画中弱；可映射 int property 或忽略 |
| `ysm.fps` | 客户端 FPS | `Minecraft.getFps()` | 无对等；固定 `60` 或忽略 |
| `ysm.is_passenger` | 是否乘骑 | `entity.isPassenger()` | `query.is_riding`（需验证主体） |
| `ysm.is_sleep` | 睡觉 Pose | `Pose.SLEEPING` | 基岩睡眠/床相关 query 或自建 property |
| `ysm.is_sneak` | 潜行（贴地+CROUCHING） | 见绑定 | 女仆少用；可 `0` |
| `ysm.is_open_air` | 可见天空且高度图 ≤ 脚高 | `isOpenAir` | script 探测；或近似 `0/1` |
| `ysm.eye_in_water` | 眼部在水下 | `isUnderWater()` | 已有水相关 query 转换（`WaterQueryResolvers`）；可对标 `query.is_underwater` 等 |
| `ysm.frozen_ticks` | 冰冻 tick | `getTicksFrozen()` | 无则 `0` |
| `ysm.air_supply` | 氧气 | `getAirSupply()` | 无则默认满值 |
| `ysm.has_chest_plate` / `has_leggings` / `has_boots` | 各甲槽非空 | `getSlotValue` | `is_item_equipped('slot.armor.*')` |
| `ysm.is_riptide` | 激流旋转 | `isAutoSpinAttack()` | 女仆几乎不用 → `0` |
| `ysm.armor_value` | 护甲值 | `getArmorValue()` | 需脚本或 `0` |
| `ysm.hurt_time` | 受伤红闪时间 | `hurtTime` | 可用受击动画/自建；或 `0` |
| `ysm.on_ladder` | 攀爬 | `onClimbable()` | 近似 `query.is_on_ground==0` 不可靠；建议 property |
| `ysm.ladder_facing` | 梯子朝向 0–3 | `LadderFacingVariable` | script；默认 `0` |
| `ysm.arrow_count` / `stinger_count` | 插箭/刺钉数 | LivingEntity API | `0` |
| `ysm.attack_damage` 等属性组 | ATTACK_DAMAGE / SPEED / KNOCKBACK / MOVEMENT_SPEED / … | `Attributes.*` | 动画罕用 → `0` 或常量 |
| `ysm.block_reach` 等 Forge 属性 | ForgeMod 扩展属性 | `ForgeMod.*` | 基岩无 → `0` |
| `ysm.rendering_in_inventory` | 是否在 GUI 渲染 | 恒 `false`（女仆适配） | `query.is_in_ui` 更贴切时可替换 |
| `ysm.dump_mods` / `texture_name` / `elytra_rot_*` | 占位防报错 | 空/`0` | 保持 `0`/`''` |
| `ysm.dump_effects` / `dump_biome` / `biome_category` | 占位 | `0` | 保持 `0` |
| `ysm.first_person_mod_hide` | 第一人称模组隐藏 | 恒 `false` | `0` |
| `ysm.has_left/right_shoulder_parrot` 及 variant | 肩头鹦鹉 | 恒 false/0 | `0` |

---

## 4. `ctrl.*`（Immersive Melodies）

| 变量 | 用途 | Java 位置 | 官方包 | 建议 |
|------|------|-----------|--------|------|
| `ctrl.im_pitch` / `im_volume` / `im_current` / `im_delta` / `im_time` | 沉浸音乐演奏进度 | `ImmersiveMelodiesCompat` / `ImmersiveMelodiesCompatInner`；未装模组时全 `0` | 未使用 | 基岩无对应模组则恒 `0`；若未来支持再脚本同步 |

---

## 5. 适配实施建议（给转换器）

### 5.1 分层策略

1. **P0 纠错**：`food_level`、`has_mainhand`/`has_offhand`（错误语义或高曝光）  
2. **P1 观感**：`input_vertical`、`second_order`、`has_helmet`/`has_elytra`  
3. **P2 完备**：`bone_rot/pos/scale`、其余 `YSMBinding` 占位变量、`first_order`、`tlm.is_begging`  
4. **P3**：`ctrl.*`、Forge 专用属性

### 5.2 规则落点

- 单段字段：继续扩 `MOLANG_YSM_RESOLVE_RULES` / `MOLANG_TLM_RESOLVE_RULES`（与现有 `startsWith` 一致）。  
- 函数调用（`second_order`/`bone_rot`/…）：需在 `APMolang` / `PrefixedExpression` 层做 **调用级** 改写，不能只靠单段字段 `startsWith`。  
- 需要实体状态的：优先新 `thlm:*` property + BP 脚本，与 `is_sitting` / `backpack_type` 同一模式。

### 5.3 与现有能力的衔接

| 已有能力 | 可复用到 |
|----------|----------|
| `ItemQueryResolvers`（手持槽位名转换） | `has_*` / 附魔查询的槽位字符串统一 |
| `AnimationTemplates` + `v.ysm_*` / `v.tlm_*` | 眨眼、坐下模式可推广到 hunger/equipment |
| `gecko-tail-physics-bedrock.md` 弹簧状态机 | `second_order` / `first_order` 展开 |
| `environment:weather` property | `ysm.weather` |

### 5.4 验收建议

对每个 P0/P1 变量，在转换后 JSON 中断言：

- 不再出现裸 `ysm.food_level` / `ysm.has_mainhand` 等；  
- 不得把 `food_level` 落成字面 `0` 后仍保留 `<=6` 比较；  
- `second_order` 要么展开为 `v.so_*` 积分，要么显式退化为 `input`（并打转换报告）。

---

## 6. 快速对照表（仅未转换 + 官方包出现）

| 符号 | 类型 | 用途一句话 | Java | 推荐基岩方案 |
|------|------|------------|------|--------------|
| `ysm.has_mainhand` | var | 主手有物 | `YSMBinding` 槽位 | `is_item_equipped` / property |
| `ysm.has_offhand` | var | 副手有物 | 同上 | 同上 |
| `ysm.food_level` | var | 饥饿 0–20 | `MAID_HUNGER` | `thlm:hunger` property（勿兜底 0） |
| `ysm.input_vertical` | var | 前后相对移动 | `MoveInputVariable` | 脚本算相对速度 / 近似 ground_speed |
| `ysm.input_horizontal` | var | 左右相对移动 | 同上 | 同上 |
| `ysm.second_order` | fn | 二阶阻尼跟随 | `SecondOrderFunction` | 展开为 `v.*` 状态机或退化为 input |
| `ysm.bone_rot` | fn | 读他骨旋转 | `BoneRotation` | 难；映射表或 0 + 警告 |
| `ysm.has_helmet` | var | 有头盔 | 头槽非空 | `slot.armor.head` |
| `ysm.has_elytra` | var | 有鞘翅 | Elytra API | 胸甲 elytra 名 / property |

---

## 7. 参考路径索引

```
.ref/TouhouLittleMaid-1.20/src/main/java/.../geckolib3/resource/GeckoLibCache.java
.ref/TouhouLittleMaid-1.20/src/main/java/.../client/animation/gecko/molang/TLMBinding.java
.ref/TouhouLittleMaid-1.20/src/main/java/.../client/animation/gecko/molang/YSMBinding.java
.ref/TouhouLittleMaid-1.20/src/main/java/.../client/animation/gecko/molang/CtrlBinding.java
.ref/TouhouLittleMaid-1.20/src/main/java/.../client/animation/gecko/molang/variable/MoveInputVariable.java
.ref/TouhouLittleMaid-1.20/src/main/java/.../client/animation/gecko/molang/functions/{BoneRotation,SecondOrderFunction,FirstOrderFunction,...}.java

SkinPacksConvertor/src/convertor/config/MolangConvertRules.ts
SkinPacksConvertor/src/convertor/molang/tlm/TlmResolvers.ts
SkinPacksConvertor/src/convertor/molang/ysm/YsmResolvers.ts
SkinPacksConvertor/src/convertor/config/AnimationTemplates.ts
SkinPacksConvertor/docs/gecko-tail-physics-bedrock.md
```

---

*文档生成说明：出现次数来自对 `.ref/touhou_little_maid-1.0.0` 与 `SkinPacksConvertor/tools` 下动画 JSON 的静态扫描；Java API 以 `YSMBinding`/`TLMBinding` 源码为准。*
