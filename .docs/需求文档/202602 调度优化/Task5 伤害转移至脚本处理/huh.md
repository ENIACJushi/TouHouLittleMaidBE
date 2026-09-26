# 伤害转移至脚本处理（Task5）

**状态：已完成**（含 `/scriptevent thlm:test dmg` / `dmg_owner` 验收）。

**目标**：把驯服女仆承伤相关逻辑从 JSON `damage_sensor` 迁到脚本，用可扩展的伤害管线替代 `api:lv_*_tame`，为后续护甲 / 饰品减伤留挂点。

**不做（本任务）**：护甲栏 UI、饰品栏实现、实际装备数值表；弹幕承伤公式大改；NPC/雕像等非女仆实体的 `damage_sensor`。

---

## 交付摘要

- `EntityMaid.Damage.onBeforeHurt`：`beforeEvents.entityHurt`（`entityFilter.type=thlmm:maid`）
- 驯服后：主人潜行近战开菜单并免伤；主人其它伤害免疫；其它伤害 × `Level.damageTaken`（lv1 `0.9` / lv2 `0.75`）
- `Work.get < 0`（NPC/雕塑/手办等）跳过管线，仍走 JSON `damage_sensor`
- `registerModifier` / `EntityMaid.Damage.registerModifier`：护甲→饰品挂点（约定顺序：等级 → 护甲 → 饰品）
- 已删除 `thlmm:lv*_tame` 与 `api:lv_*_tame`；`Level.eventTamed` 为空操作
- 游戏内测试：`typescripts/test/maid/DamageTest.ts`（血量差断言减伤 / 主人免疫）

细节步骤见 [实现计划.md](./实现计划.md)。
