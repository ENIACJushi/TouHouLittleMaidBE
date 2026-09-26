## JSON 逻辑迁移

**状态：已完成**（槽位基础系统 + Level basic 迁槽并删旧 `lv*_basic`）

将「脚本 → JSON」原子组件装载收敛为槽位系统；JSON→脚本的 `thlmm:` 体系本任务未改。

### 目标架构

- **JSON→脚本**（既有，未动）：传感器 / 交互 / 定时器等通过 `thlmm:` 等钩子通知脚本。
- **脚本→JSON**（本任务交付）：JSON 声明原子组件组及成对装载/卸载事件；脚本在业务层之下提供带约束的 `Slots.*` API。

详见：[槽位系统-脚本到JSON.md](./槽位系统-脚本到JSON.md)

### 本任务交付

+ 「槽位」主体框架：
  + variant（`skin:N` + VariantSlot）
  + attack / health / knockback（`slot:*`，Level.eventBasic 组合调用）
+ Level basic 迁槽并删除旧 `lv*_basic`（已验证可兼容，删旧惯例见 [槽位系统 §6.1](./槽位系统-脚本到JSON.md)）

### 明确不在本任务 / 不做槽

| 项 | 处理 |
|----|------|
| `backpack` | 格数少、无灵活变动；维持 `api:backpack_*` |
| `dmg_tame` / `api:lv_*_tame` | 已由 Task5 脚本伤害管线替代并删除 JSON |
| `scale` | **可脚本直改**，不做槽 |
| `seek`（`tlm_seek:*`） | 结构需调整且当前未使用；**留到「精准目标控制」任务**再优化，不在本任务收尾 |

### 后续另线（非 Task2 槽位范围）

+ JSON 决策/副作用（音效等）迁移
+ 脚本伤害事件替代 `api:lv_*_tame` → **已完成**，见 [Task5](../Task5%20伤害转移至脚本处理/huh.md)
+ 其它系统若需挂槽：优先在对应模块 TS 化之后再接入
