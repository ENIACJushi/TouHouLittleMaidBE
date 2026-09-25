# 伤害转移至脚本处理（Task5）

**目标**：把驯服女仆承伤相关逻辑从 JSON `damage_sensor` 迁到脚本，用可扩展的伤害管线替代 `api:lv_*_tame`，为后续护甲 / 饰品减伤留挂点。

**不做（本任务）**：护甲栏 UI、饰品栏实现、实际装备数值表；弹幕承伤公式大改；NPC/雕像等非女仆实体的 `damage_sensor`。

---

## 现状（迁出前）

驯服后由 `Level.eventTamed` 挂 `thlmm:lvN_tame`，JSON `damage_sensor` 三件事：

1. 主人潜行近战 → `deals_damage: false` + `thlmm:m` → 脚本开菜单  
2. 主人任意伤害 → 免疫  
3. 其它伤害 × `0.9`（lv1）/ `0.75`（lv2）

脚本侧已有 `afterEvents.entityHurt`（仅 hurt 音效）。API 已有 `beforeEvents.entityHurt`（`cancel` + 可写 `damage`），类型包 `@minecraft/server` 2.11 beta。

---

## 方案定稿

**主路径：`world.beforeEvents.entityHurt`（限定 `thlmm:maid`）**

- 取消伤害：`event.cancel = true`（主人免疫、潜行开菜单）  
- 改伤：`event.damage = …`（等级减伤 + 日后护甲/饰品乘区）  
- 开菜单：`system.run` 调现有交互入口（对齐 `MaidInteractEvents.onInteract`），不再依赖 `thlmm:m`  
- **不采用**「JSON 全免疫 + 脚本 `applyDamage` 回打」作默认方案（易递归、延迟、与弹幕/原版因果纠缠）

野生女仆：无驯服捆包，保持原版承伤（管线只在「已驯服」时启用特殊规则）。

---

## 目标架构

```
beforeEvents.entityHurt (entityTypes=maid)
        │
   MaidDamage.onBeforeHurt
        │  主人潜行近战 → cancel + 开菜单
        │  主人其它伤害 → cancel
        │  减伤管线：等级 →（预留）护甲 →（预留）饰品 → 写回 event.damage
        │
afterEvents.entityHurt（既有）→ 仅音效等副作用
```

| 模块 | 职责 |
|------|------|
| `maid/facets/Damage.ts`（或 `maid/damage/`） | before 入口、主人判定、等级乘子、Modifier 列表 |
| `EntityEvents` | 订阅 `beforeEvents.entityHurt` |
| `Level` | 去掉 `api:lv_*_tame`；减伤乘子改读 `Level.properties` |
| `MaidGenerator` | 删除 `thlmm:lv*_tame` 组与 `api:lv_*_tame` 事件 |

**护甲/饰品铺路**：管线内预留 `DamageModifier[]`（`id` + `(ctx, damage) => number`），本任务只注册等级修正；饰品/护甲任务再 `register`。

---

## 验收

- [ ] 驯服 lv1/lv2：主人打不掉血；潜行左键开菜单且不扣血  
- [ ] 非主人伤害约为原伤害 ×0.9 / ×0.75（手感对齐现网）  
- [ ] 野生女仆承伤与迁前一致  
- [ ] 无 `api:lv_*_tame` / `thlmm:lv*_tame`；`Level.set` / 驯服成功不再 trigger 这些事件  
- [ ] hurt 音效仍正常；弹幕打女仆不异常连环伤  

细节步骤见 [实现计划.md](./实现计划.md)。
