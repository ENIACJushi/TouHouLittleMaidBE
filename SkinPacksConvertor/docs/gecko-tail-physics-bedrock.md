# Gecko 酒狐摇尾：基岩转换原理与本轮做法

> 对应问题：店员酒狐 / 小酒狐等 Gecko 皮肤转换后尾巴完全静止。  
> 验证：重转换并安装开发资源包后，尾巴可正常摆动。

## 1. Java/Gecko 侧在做什么

酒狐尾巴不是普通关键帧，而是一套 **弹簧物理**：

| 阶段 | 动画通道 | 作用 |
|------|----------|------|
| 目标角 | `pre_parallel2` 的 `molang` / `molang2` / `molang3` 伪骨骼 | 写 `v.tail*`、`v.s` / `v.f` 等 |
| 弹簧常数 | `parallel1` / `parallel3` 的 `timeline` | 写 `v.L*_F/C/R/K*` |
| 积分推进 | `parallel2` / `parallel4` 的 `timeline` | 写 `v.L*_P*`（状态量，跨帧累积） |
| 驱动骨骼 | `pre_parallel2` 的 Tail 骨骼 | 旋转读 `v.L13_P*` / `v.L1_P0` 等 |

要点：

- Java/Gecko 未赋值的 `v.*` 视为 `0`。
- `timeline` 里的赋值在 Java 侧可每帧可靠执行。
- 伪骨骼 `molang*` 只承载脚本，不是真正渲染骨骼。

## 2. 转换到基岩后为什么会“完全静止”

本轮问题是多层叠加，按发现顺序：

1. **未知变量被兜底成常数**  
   `VariableResolvers` 对未 keep 的 `v.*` 替换为 `0`/`1`。  
   弹簧状态与 `v.tail*` 若未进白名单，Tail 通道会变成常量表达式，尾巴锁死。

2. **`molang3` 未被识别为伪骨骼**  
   只处理了 `molang` / `molang2` 时，`v.s` / `v.f` 等目标参数丢失。

3. **基岩要求“先赋值再读取”**  
   ContentLog 会报 `variable.l1_p0` 等 unknown variable。  
   Java 默认可为 0；基岩必须先出现赋值。

4. **动画 `timeline` 不适合承载弹簧积分**  
   RP 动画 timeline 对高频状态赋值不可靠，需抽到实体 `scripts`。

5. **门控脚本排在 `v.animate_*` 赋值之前**  
   `(v.animate_parallel4==id) ? { ... }` 若在 showCondition 之前执行，体内逻辑永远不跑。

6. **同帧顺序：先目标、后积分**  
   `pre_parallel`（写 `tail*`）应排在 `parallel`（积 `L*_P*`）之前。

7. **致命：把 `v.xxx=0` 写进了每帧的 `pre_animation`**（本轮最终根因）  
   弹簧状态每帧先被清零再积分 → 净效果恒为静止。  
   **一次性默认值必须放在 `scripts.initialize`。**

## 3. 正确的基岩执行模型

```
实体加载
  └─ scripts.initialize
       └─ v.L*_P*=0; v.tail*=0; …（只跑一次）

每一帧
  └─ scripts.pre_animation
       ├─ 模板基础变量（walk / tcos0 / …）
       ├─ showCondition → v.animate_* = 当前皮肤对应 id
       ├─ 门控：pre_parallel 抽出的目标赋值（v.tail*、v.s…）
       ├─ 门控：parallel 抽出的常数 + 弹簧积分（v.L*_P*）
       └─ （可选）抑制 molang 眨眼等
  └─ scripts.animate
       └─ 按 v.animate_* 播放骨骼动画（Tail 读已积好的 v.L*_P*）
```

抽出的脚本里若含 `query.anim_time`，在实体 scripts 中无动画上下文，需改为 `query.life_time`。

## 4. 代码层面的做法（按模块）

### 4.1 `APMolang.ts`（抽取与 keep）

- 伪骨骼名：`/^molang\d*$/i`（含 `molang3`）。
- 两遍处理：先登记所有伪骨骼赋值左值到 keep，再抽取脚本并删除伪骨骼（避免 `molang2` 引用尚未处理的 `molang3` 被兜底）。
- `timeline` 赋值左值同样登记 keep；纯赋值整段 flatten 进 `extractedScripts`，并删除 `timeline`。
- 去掉不可靠的 `blend_weight`。
- `anim_time` → `life_time`（实体 scripts 上下文）。

### 4.2 `VariableResolvers.ts` + `MolangConvertRules.ts`

- 动态 keep：`registerMolangVariableKeep` / `getDynamicMolangKeepFields`。
- 静态规则增加 `{ name: 'tail', type: 'keep' }`，覆盖 `v.tail1y` 等。
- 命中静态 keep 时也会写入动态集合，便于导出时统一 `initialize=0`。

### 4.3 `MaidAnimationConvertor.ts`（导出到实体）

- `extractedScripts` 左值 → `scripts.initialize` 写 `v.xxx=0;`（去重）。
- 剩余动态 keep 字段补齐到 `initialize`。
- 赋值体延后为门控串，在 showCondition **之后** 压入 `pre_animation`。
- 门控排序：`animate_pre_parallel*` 优先于其它 parallel。
- `AnimationScriptsDefinition.initialize` 为必填数组，经 `SkinConvertor` 挂到 client_entity。

### 4.4 其它辅助

- `AnimationTemplates`：`gliding_speed_value=1` 须在 `tcos0` 之前。
- 共用工具：`molang/MolangAssign.ts`（赋值 `=` 定位、左值解析、去重键），避免转换器与 APMolang 各写一套。

## 5. 变量与职责划分（优化后约定）

| 位置 | 写什么 | 不要写什么 |
|------|--------|------------|
| `scripts.initialize` | 状态/目标等 keep 变量的默认 `0` | 每帧会变的积分体、门控体 |
| `scripts.pre_animation` | showCondition、门控赋值体、帧逻辑 | `v.L*_P*=0` 这类清状态初始化 |
| 动画 bones | Tail 等对 keep 变量的读取 | 依赖未知变量被兜底后的常数尾巴 |
| 动画 timeline | （转换后尽量空）弹簧类赋值已抽出 | 继续依赖 timeline 做状态机 |

命名约定：

- `extractedScripts`：转换期暂存，导出后删除。
- `registeredScriptVars`：已在 initialize / 模板 scripts 出现过的变量键（`v.xxx` 小写）。
- `deferredGatedScripts`：等 `v.animate_*` 赋值后再追加的门控串。

## 6. 验证步骤

```bash
cd SkinPacksConvertor
npm run test:convert -- --move
```

1. 确认 `entity/maid.entity.json` 中 `scripts.initialize` 含 `v.L13_P0=0` 等，且 **`pre_animation` 中没有** 每帧 `L*_P*=0`。
2. 确认存在 `(v.animate_pre_parallel2==…)` 与 `(v.animate_parallel4==…)` 门控。
3. 游戏内 **重进世界 / 重选皮肤**（`initialize` 仅在实体加载时执行）。
4. 观察店员酒狐 / 小酒狐尾巴；ContentLog 不应再刷大量 unknown `variable.l*`。

## 7. 相关文件

- `src/convertor/animation/processor/APMolang.ts`
- `src/convertor/animation/MaidAnimationConvertor.ts`
- `src/convertor/molang/MolangAssign.ts`
- `src/convertor/molang/v/VariableResolvers.ts`
- `src/convertor/config/MolangConvertRules.ts`
- `src/convertor/config/AnimationTemplates.ts`
- `src/convertor/model/Templates.ts`
- `src/convertor/animation/types/AnimationSchema180.ts`
