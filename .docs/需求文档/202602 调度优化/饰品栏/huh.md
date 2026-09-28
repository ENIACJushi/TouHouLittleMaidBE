# 饰品栏：部分格位只允许指定物品

**状态：** 调研草案（卡点结论已给出）。  
**关联：** Task5 已预留 `Damage.registerModifier`（等级 → 护甲 → 饰品）；现有 bauble 配方 / 物品 id 已在仓库。

**卡点：** 如何让女仆物品栏的 **部分格位** 只能放入指定物品。

---

## 1. 现网相关实现

| 点 | 说明 |
| --- | --- |
| 女仆库存 | `minecraft:inventory`，`container_type: inventory`，容量随背包 6/12/24/36（`Backpack.ts` / `template.js`） |
| 查包 | 潜行改 `nameTag` 前缀打开库存 UI（无自定义 JSON UI） |
| 饰品物品 | 已有 `*_bauble` 配方（mute / fall / fire / …） |
| 设计备忘 | `.docs/设计思想.md`：潜行时把护甲/饰品等同步到背包实体 |

当前 **没有** 按格过滤逻辑。

---

## 2. 官方 / 社区能力盘点

### 2.1 `minecraft:inventory`（实体）

字段：`inventory_size`、`container_type`、`restrict_to_owner`、`private`、`can_be_siphoned_from` 等。  
**无** `allowed_items` / 按格白名单。  
打开后是普通容器 UI，玩家可向任意空格拖入任意物品。

### 2.2 `Container.containerRules`（Script）

- 接口：`allowedItems` / `bannedItems` / `allowNestedStorageItems` / `weightLimit`
- 作用域：**整个 Container**，不是某一格
- 属性为 **`read-only`**：脚本 **不能** 给女仆库存随便挂规则
- 规则来源：主要是物品侧 `minecraft:storage_item`（Bundle 类）；违规操作抛 `ContainerRulesError`

→ **不能**解决「女仆 inventory 第 N 格只收某类物品」。

### 2.3 `minecraft:storage_item`（物品组件）

Bundle 式容器：`allowed_items` / `banned_items` / `max_slots`（需配合 `bundle_interaction`）。  
引擎会挡非法放入，但是：

- 挂在 **物品** 上，不是实体库存格
- 白名单仍是 **整袋同一套**，不是「第 1 格只能 mute、第 2 格只能 fall」

可用作「饰品袋」整体只收 bauble，**不能**单独实现分类型格。

### 2.4 `minecraft:equippable`（实体）⭐ 唯一原生「按格 accepted」

JSON 每格可写：

```json
"accepted_items": ["carpet"]
```

原版羊驼地毯即此模式。`on_equip` / `on_unequip` 可接线。

限制：

- 交互偏 **装备交互**，不是普通箱子拖拽格（体验与查包 UI 不同）
- Script `EntityEquippableComponent` 文档写明面向 **player**，`EquipmentSlot` 枚举是 head/chest/legs/feet/mainhand/offhand 等标准槽；**自定义 slot 编号能否脚本读写需探针验证**
- 与现有「库存查包」两套路需产品取舍

### 2.5 `ItemLockMode`（slot / inventory）

锁的是 **已在格内物品** 能否挪出/丢弃/合成，**不是** 谁能放进来。

### 2.6 库存变更事件

- `afterEvents.playerInventoryItemChange`：仅 **玩家** 库存，且是 after，不可 cancel
- **没有**「实体容器 before 放入可取消」的公开事件
- `before` 回调里也 **不能** `setItem`（restricted execution）

→ 对女仆库存：无法在放入瞬间原生拒绝；最多 **放入后** 脚本纠正。

### 2.7 自定义 JSON UI

社区可做自定义 container slot，但 **默认不提供 item id 白名单**；仍要脚本校验，或彻底改成「点选装备」非拖拽。

---

## 3. 方案对比

| 方案 | 按格白名单 | 引擎强制 | 与现查包 UI | 结论 |
| --- | --- | --- | --- | --- |
| A. 实体 inventory + 期望 ContainerRules | 否（且只读） | — | 兼容 | **不可行** |
| B. `storage_item` 饰品袋 | 整袋同一名单 | 是 | 另开袋 UI | 适合「任意 bauble 任意格」；不适分类型格 |
| C. `equippable` + `accepted_items` | **是** | 是 | 交互可能不同 | **原生最优**；需验 UI/脚本槽 |
| D. 库存预留格 + 脚本纠错 | 是（逻辑层） | 否（先入后剔） | **兼容** | **实用主方案** |
| E. 纯脚本菜单穿戴 | 是 | 否 | 非拖拽 | UX 差，可作补充 |
| F. 独立 1 格实体 × N | 每实体整容器名单 | 弱 | 重 | 不推荐 |

---

## 4. 推荐结论（最佳组合）

### 4.1 主路径（对齐现网查包）：**预留格 + 脚本强制**

1. 在女仆 `inventory` 尾部划出饰品格（或单独扩大容量并约定索引）。  
2. 规则表：`slotIndex → 允许的 itemId / tag`（mute 槽、防护槽等；或「任意 bauble」）。  
3. 触发纠错：  
   - 查包打开 / 关闭  
   - 定时轻量扫描（仅主人附近 / 查包中）  
   - 交互 after  
4. 非法物品：弹回玩家库存 / 掉落 / 挪到普通格；可选 actionbar 提示。  
5. 业务读饰品：只读约定索引；接入 Task5 `registerModifier`、Mute 等。

缺点：极短「错误放入」窗口；无引擎级拒绝。  
优点：不改查包 UX；不依赖未验证的 equippable 脚本面。

### 4.2 并行探针（若要引擎级按格过滤）：**equippable**

做一轮验证：

- 女仆挂多格 `equippable`，每格不同 `accepted_items`  
- 玩家能否方便穿脱；是否与 `inventory` 查包冲突  
- 脚本能否读写非标准 `EquipmentSlot`

若体验可接受，可把饰品迁到 equippable，库存只留杂物——**原生按格白名单**。

### 4.3 不推荐当主方案

- 指望给 `EntityInventory` 设 `containerRules`  
- 仅靠 `ItemLockMode`  
- 为每个饰品类型做一个实体库存

### 4.4 产品语义建议

| 需求 | 更合适的技术 |
| --- | --- |
| 多个槽、**每槽不同类型** bauble | D 脚本规则表，或 C equippable |
| 若干槽、**任意 bauble 可进任一槽** | D 宽松规则，或 B 饰品袋 `allowed_items=全部 bauble` |
| 必须拖拽零闪烁引擎拒绝 | 优先探针 C；实体库存做不到 |

Java 版分类型饰品槽 → BE 没有同等 API，需 D 或 C 仿真。

---

## 5. 建议落地顺序

1. **Phase 0 探针**  
   - equippable 多格 `accepted_items` 在女仆上的 UX / 脚本读写  
   - 库存预留格 + `system.run` 纠错延迟与闪烁手感  
2. **定案** 主用 D 或 C（或饰品 C、杂物 inventory）  
3. **实现** 规则表 + 读写门面 + 接到 Damage / Mute  
4. **再** 考虑隙间等依赖饰品的系统（见 `.docs/TODO.md`）

---

## 6. 参考链接

- [ContainerRules](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/containerrules)  
- [Container.containerRules](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/container)  
- [minecraft:equippable](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_equippable)  
- [minecraft:inventory](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_inventory)  
- [storage_item / Bundle](https://wiki.bedrock.dev/items/item-components)（Bedrock Wiki）  
- [ItemLockMode](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/itemlockmode)  
- [Execution privilege（before 不可改世界）](https://learn.microsoft.com/en-us/minecraft/creator/documents/scripting/execution-privilege)  
