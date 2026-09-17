# @minecraft/server Entity 相关 API 变更总结

## 对比范围

| 项 | 旧版 | 新版 |
| --- | --- | --- |
| 包版本 | `2.3.0-beta.1.21.111-stable` | `2.11.0-beta.1.26.51-stable` |
| 声明文件 | `TouHouLittleMaidBE/.../node_modules/@minecraft/server/index.d.ts` | `minecraft-server/.../node_modules/@minecraft/server/index.d.ts` |
| 文件行数 | 23301 | 29716 |

本文汇总名称含 **Entity** 的导出（类型 / 组件 / 事件 / 枚举等），以及 `Entity` 主类、`WorldAfterEvents` / `WorldBeforeEvents`、`Dimension` 上与实体相关的成员变化。

## 变更摘要

从 `2.3.0-beta` 升到 `2.11.0-beta`，Entity 相关导出 **只增不减**（+50 / -0）。重点变化：

1. **`Entity` 主类**：新增背包快捷入包 `addItem`、碰撞盒 `getAABB`、铭牌渲染属性；`setDynamicProperties` 允许值为 `undefined`（便于批量清除）。
2. **事件面显著扩充**：容器开/关、治疗（heal）、掉落/拾取物品、潜行起停、驯服、实体升级（upgrade）；并补齐部分 **before** 事件（heal / hurt / itemPickup / tamed）。
3. **组件**：新增末影箱库存 `minecraft:ender_inventory`（`EntityEnderInventoryComponent` / `EntityComponentTypes.EnderInventory`）。
4. **受伤订阅选项收紧**：`EntityHurtAfterEventSignal.subscribe` 的 options 从通用 `EntityEventOptions` 改为专用 `EntityHurtAfterEventOptions`。
5. **`Dimension` 实体相关 API**：本次对比无成员增删改。
6. 另有战利品条件/函数、可见性规则、`EntityWaypoint`、`InvalidEntityComponentError` 等配套类型。

---

## 1. 导出符号总览

- 旧版 Entity 相关导出：**128**
- 新版 Entity 相关导出：**178**
- 新增：**50**
- 移除：**0**

### 1.1 按类别归纳（新增）

| 类别 | 新增符号 |
| --- | --- |
| 事件 / 信号 | `EntityContainerClosed/Opened*`、`EntityHeal*`、`EntityHurtBefore*`、`EntityItemDrop*`、`EntityItemPickup*`、`EntityStart/StopSneaking*`、`EntityTamed*`、`EntityUpgrade*` |
| 事件 Options | `EntityContainerAccessEventOptions`、`EntityHealEventOptions`、`EntityHurtAfter/BeforeEventOptions`、`EntityItemDrop/PickupEventOptions`、`EntitySneakingChangedEventOptions`、`EntityTamedEventOptions` |
| 组件 | `EntityEnderInventoryComponent` |
| 枚举 | `EntityAttachPoint`、`EntityHealCause`、`EntitySwingSource` |
| 其他类型 | `EntityHealSource`、`EntityVisibilityRules`、`EntityWaypoint`、`InvalidEntityComponentError`、`BlockComponentEntityEvent` |
| 战利品相关 | `CarryOverBlockEntityDataFunction`、`DamagedByEntityCondition`、`EntityHasMarkVariantCondition`、`EntityHasVariantCondition`、`EntityKilledCondition`、`KilledByEntityCondition`、`PassengerOfEntityCondition` |

### 1.2 新增导出（完整列表）

| 名称 | 种类 | 备注 |
| --- | --- | --- |
| `BlockComponentEntityEvent` | class | 方块组件实体事件相关 |
| `CarryOverBlockEntityDataFunction` | class | 战利品相关 |
| `DamagedByEntityCondition` | class | 战利品相关 |
| `EntityAttachPoint` | enum | 附着点 |
| `EntityContainerAccessEventOptions` | interface | 选项/结构 |
| `EntityContainerClosedAfterEvent` | class | 事件 |
| `EntityContainerClosedAfterEventSignal` | class | 事件信号 |
| `EntityContainerOpenedAfterEvent` | class | 事件 |
| `EntityContainerOpenedAfterEventSignal` | class | 事件信号 |
| `EntityEnderInventoryComponent` | class | 组件 |
| `EntityHasMarkVariantCondition` | class | 战利品相关 |
| `EntityHasVariantCondition` | class | 战利品相关 |
| `EntityHealAfterEvent` | class | 事件 |
| `EntityHealAfterEventSignal` | class | 事件信号 |
| `EntityHealBeforeEvent` | class | 事件 |
| `EntityHealBeforeEventSignal` | class | 事件信号 |
| `EntityHealCause` | enum | 治疗原因 |
| `EntityHealEventOptions` | interface | 选项/结构 |
| `EntityHealSource` | class | 治疗来源 |
| `EntityHurtAfterEventOptions` | interface | 选项/结构 |
| `EntityHurtBeforeEvent` | class | 事件 |
| `EntityHurtBeforeEventOptions` | interface | 选项/结构 |
| `EntityHurtBeforeEventSignal` | class | 事件信号 |
| `EntityItemDropAfterEvent` | class | 事件 |
| `EntityItemDropAfterEventSignal` | class | 事件信号 |
| `EntityItemDropEventOptions` | interface | 选项/结构 |
| `EntityItemPickupAfterEvent` | class | 事件 |
| `EntityItemPickupAfterEventSignal` | class | 事件信号 |
| `EntityItemPickupBeforeEvent` | class | 事件 |
| `EntityItemPickupBeforeEventSignal` | class | 事件信号 |
| `EntityItemPickupEventOptions` | interface | 选项/结构 |
| `EntityKilledCondition` | class | 战利品相关 |
| `EntitySneakingChangedEventOptions` | interface | 选项/结构 |
| `EntityStartSneakingAfterEvent` | class | 事件 |
| `EntityStartSneakingAfterEventSignal` | class | 事件信号 |
| `EntityStopSneakingAfterEvent` | class | 事件 |
| `EntityStopSneakingAfterEventSignal` | class | 事件信号 |
| `EntitySwingSource` | enum | 挥击来源 |
| `EntityTamedAfterEvent` | class | 事件 |
| `EntityTamedAfterEventSignal` | class | 事件信号 |
| `EntityTamedBeforeEvent` | class | 事件 |
| `EntityTamedBeforeEventSignal` | class | 事件信号 |
| `EntityTamedEventOptions` | interface | 选项/结构 |
| `EntityUpgradeAfterEvent` | class | 事件 |
| `EntityUpgradeAfterEventSignal` | class | 事件信号 |
| `EntityVisibilityRules` | interface | 可见性规则 |
| `EntityWaypoint` | class | 路径点（实体侧） |
| `InvalidEntityComponentError` | class | 错误 |
| `KilledByEntityCondition` | class | 战利品相关 |
| `PassengerOfEntityCondition` | class | 战利品相关 |

### 1.3 移除导出

_无_

## 2. `Entity` 主类成员变化

### 2.1 新增成员

| 成员 | 说明（来自声明注释） |
| --- | --- |
| `addItem(itemStack: ItemStack): ItemStack \| undefined` | 向实体库存添加物品；全部放入则返回 `undefined`，否则返回剩余 `ItemStack`。可能抛 `ContainerRulesError` / `InvalidEntityComponentError` / `InvalidEntityError` |
| `getAABB(): AABB` | 获取实体碰撞 AABB |
| `nameplateDepthTested: boolean` | 铭牌是否做深度测试（可见性） |
| `nameplateRenderDistance: number` | 铭牌渲染距离 |

### 2.2 移除成员

_无_

### 2.3 签名变更

- **`setDynamicProperties`**
  - 旧: `setDynamicProperties(values: Record<string, boolean | number | string | Vector3>): void;`
  - 新: `setDynamicProperties(values: Record<string, boolean | number | string | Vector3 | undefined>): void;`
  - 含义：Record 值允许 `undefined`，便于批量清除动态属性。

## 3. `EntityComponentTypeMap` 组件键变化

- 新增组件键：**1**
- 移除组件键：**0**

### 新增

- `minecraft:ender_inventory` → `EntityEnderInventoryComponent`

## 4. Entity 相关枚举成员变化

### `EntityComponentTypes`

新增:

- `EnderInventory`

## 5. `WorldAfterEvents` 中 Entity 相关成员

### 新增

- `readonly entityContainerClosed: EntityContainerClosedAfterEventSignal;`
- `readonly entityContainerOpened: EntityContainerOpenedAfterEventSignal;`
- `readonly entityHeal: EntityHealAfterEventSignal;`
- `readonly entityItemDrop: EntityItemDropAfterEventSignal;`
- `readonly entityItemPickup: EntityItemPickupAfterEventSignal;`
- `readonly entityStartSneaking: EntityStartSneakingAfterEventSignal;`
- `readonly entityStopSneaking: EntityStopSneakingAfterEventSignal;`
- `readonly entityTamed: EntityTamedAfterEventSignal;`
- `readonly entityUpgrade: EntityUpgradeAfterEventSignal;`

### 移除

_无_

### 签名变更

_无_

## 6. `WorldBeforeEvents` 中 Entity 相关成员

### 新增

- `readonly entityHeal: EntityHealBeforeEventSignal;`
- `readonly entityHurt: EntityHurtBeforeEventSignal;`
- `readonly entityItemPickup: EntityItemPickupBeforeEventSignal;`
- `readonly entityTamed: EntityTamedBeforeEventSignal;`

### 移除

_无_

### 签名变更

_无_

## 7. `Dimension` 上与实体相关的成员

### 新增

_无_

### 移除

_无_

### 签名变更

_无_

## 8. 其他已有 Entity* 类型的成员变化

下列为名称含 Entity 的 class/interface（不含 `Entity` 主类）中，成员有增删改者。

### `EntityHurtAfterEventSignal`

签名变更:

- **`subscribe`**
  - 旧: `subscribe( callback: (arg0: EntityHurtAfterEvent) => void, options?: EntityEventOptions, ): (arg0: EntityHurtAfterEvent) => void;`
  - 新: `subscribe( callback: (arg0: EntityHurtAfterEvent) => void, options?: EntityHurtAfterEventOptions, ): (arg0: EntityHurtAfterEvent) => void;`

### `EntityType`

新增:

- `readonly localizationKey: string;` — 本地化键

### `InvalidEntityError`

签名变更:

- **`id`**
  - 旧: `id: string;`
  - 新: `readonly id: string;`
- **`type`**
  - 旧: `type: string;`
  - 新: `readonly type: string;`

## 9. 迁移提示（简要）

1. 女仆/实体库存逻辑可评估改用 `entity.addItem(...)`，注意返回剩余堆叠与组件缺失错误。
2. 需要碰撞/交互判定时可使用 `getAABB()`。
3. 订阅 `entityHurt` 后事件时，若传了 options，需改用 `EntityHurtAfterEventOptions`。
4. 需要拦截伤害/治疗/拾取/驯服时，优先看 `world.beforeEvents` 新增信号。
5. 末影箱相关玩法可用 `EntityComponentTypes.EnderInventory`。

---

生成说明：基于两份 `index.d.ts` 的导出与成员签名自动对比；包版本 `2.3.0-beta.1.21.111-stable` → `2.11.0-beta.1.26.51-stable`。
