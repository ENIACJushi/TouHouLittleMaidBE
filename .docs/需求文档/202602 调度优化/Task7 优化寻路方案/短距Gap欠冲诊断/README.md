# 短距 Gap 欠冲诊断（Task7）

## 现象（基线已归档）

连跳路径末段 `SprintGap dist=2, dy=0` 相对对岸格心常 **欠冲**（`PATHGAP|LAND along < 0`，约 −0.25～−0.5），落在垫格近棱；短距非偶发。  
长跨 `3:0`/`4:0` 相对更好；`dy=-1` 曾过冲（另案）。

**现行基线（勿混入已回退的试修）：**

- 格心瞄准：`targetH = actualH`
- FIT：Phase0c 复测 `first_touch + seek=on`（远端 marker）
- Gap：**全程保留 Seek**；落地 `clearHorizontalVelocity`
- 已回退：飞行中卸 Seek、`DOWN_SOLVE_SCALE`

日志抓取：`PATHGO|` / `PATHGAP|IMPULSE|LAND`（`path_go`）。

## 目标

一条条隔离因素，弄清「短距较近」主因，再改一处验证一处。  
每步只改一个变量；用 **单跳 2:0** 为主，避免连跳误差累积。

## 度量

每跳记录（已有 PATHGAP 字段即可）：

| 字段 | 含义 |
| --- | --- |
| `actualH` / `targetH` / `hx,hy` | 瞄准与冲量 |
| `padOffH` | 起跳相对本垫格心偏置 |
| `along` | 落地相对对岸格心，沿跳向（负=欠冲） |
| `travel = \|land−from\|` | 实际水平位移 |
| `predH = FIT(hx,hy)` | 应约等于 `targetH` |
| `short = targetH − travel` | 相对瞄准的欠冲 |

判定：`|along| ≤ 0.15` 视为可贴格心；`along ≤ −0.25` 记为短距问题复现。

## 场景搭建

平地两垫，轴对齐，**仅一跳 `2:0`**：

- 起跳垫 / 对岸垫各 1 格宽，沟宽使规划 `h=2`
- 女仆脚位置于起跳垫 **格心**（`padOffH≈0`）后再 `path_go` 到对岸垫（或仅含这一条 SprintGap 的短路径）
- 每条件重复 ≥3 次，看 `along` 均值与方差

## 测试序列（按序，勿跳步）

### T0 — 基线复现

- 条件：现行代码，单跳 2:0，格心起跳
- 期望：稳定 `along < 0`（复现短距欠冲）
- 产出：3～5 条 `IMPULSE/LAND` 贴档

### T1 — 与 FIT 扫测对齐：同 hx/hy 裸冲量

- 目的：排除「反解/路径」以外的物理差
- 做法：临时探针或改 `doImpulse` 日志旁路——对固定 `(hx,hy)=(0.45,0.42)` 等扫测网格点，**不经 resolve**，与 Phase0c 同：clearVelocity → impulse → 首触地记 H
- Gap 场景（对岸有垫）vs 平地跑道各 3 次
- 判定：
  - 若 Gap 上 `travel ≈` 扫测 `meanH` → FIT 可用，问题在瞄准距离/连跳/Seek 配置
  - 若 Gap 上明显更短 → 环境差（Seek marker 距、对岸碰撞、落地判定）

### T2 — Seek marker 距离

- 目的：验证「近距对岸 marker」是否系统性缩短射程（非偶发）
- 做法：单跳 2:0，仅改 marker 水平距（对岸格心 / 再远 4～8 格假目标），其余不变
- 判定：近 marker 欠冲、远 marker 接近 FIT → Seek 几何是主因之一；两档无差 → 排除近距 Seek

### T3 — 飞行中 Seek 有无（单独开关）

- 目的：与 T2 正交；只开关飞行段 Seek，不改 FIT
- 做法：冲量后 `quitSeek` vs 保留；落地再挂回
- 判定：仅卸 Seek 明显减欠冲 → 飞行追逐干扰；无差 → 不是 Seek 主因（与「短距非偶发」叙事一致时，应把精力转 T1/T4）

### T4 — 起跳 padOff（近棱 / 格心 / 远棱）

- 目的：连跳末段常从偏置起跳
- 做法：固定 2:0，人为 `padOffH ∈ {0, ±0.3, ±0.45}`
- 判定：仅偏置时恶化 → 连跳误差放大；格心仍欠冲 → 短距模型本身有偏

### T5 — 反解 vs 表内固定 hx

- 目的：区分 FIT 反解误差与 Phase0b `hy` 桶
- 做法：同 `actualH`，A) `resolveImpulseEx` 反解 hx；B) 强制表内 `"2:0"` 的 hx/hy
- 判定：B 更好 → 反解/FIT 短距段失真；两者都差 → hy 或物理环境

### T6 — 连跳末两跳 vs 单跳

- 目的：确认「末两跳」是否仅为累积
- 做法：完整多 Gap 路线只盯 i=5,6；对比 T0 单跳
- 判定：单跳已差 → 根因在短距本身；仅连跳差 → 优先管落地刹停/起跳对齐

## 记录模板

```
条件: T? / seek=on|off / marker=near|far / padOff=?
IMPULSE: actualH= targetH= hx= hy=
LAND: along= travel= short= predH=
结论: 支持/否定 假设 ___
```

## 建议结论流向

1. T0 复现 → T1  
2. T1 Gap≪扫测 → T2/T3（环境/Seek）  
3. T1 Gap≈扫测 → T5（反解）→ 必要时 **短距单独重扫 FIT**（marker 几何对齐 Gap）  
4. 确认主因后再改生产；禁止同时拧多项补偿

## 与归档关系

- Phase0c 复测日志/探针：`../Phase0c-冲量扫测归档/`  
- 本诊断过程日志建议放：`./logs/`（按日期命名）  
- **勿**把临时探针常驻 BP；`PathFollow` / `path_go` 永久保留
