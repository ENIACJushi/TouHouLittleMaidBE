## JSON 逻辑迁移

将 JSON 执行的决策和动作（如播放音效）等尽量移到脚本侧。

### 目标架构（总述）

- **JSON→脚本**（既有）：传感器 / 交互 / 定时器等通过 `thlmm:` 等钩子通知脚本；**本阶段不改这套体系**。
- **脚本→JSON**（本阶段要建）：JSON 只声明原子组件组及成对装载/卸载事件；脚本在业务层之下提供带约束的调用接口。

详见：[槽位系统-脚本到JSON.md](./槽位系统-脚本到JSON.md)

### 实现计划

+ 一些组件现在已经可以被脚本直接修改，在迁移前可以先确认一下
+ 「槽位」主体框架：
  + ~~variant（`skin:N` + VariantSlot）~~
  + ~~attack（`slot:attack_*`）~~
  + ~~health（`slot:health_*`，`Health.setMax`）~~
  + ~~knockback（`slot:knockback_*` 百分制）~~
+ **P0 / Level basic 已完成，且已验证：删旧 `lv*_basic` 可兼容**（惯例见 [槽位系统 §6.1](./槽位系统-脚本到JSON.md)）
+ 下一步见 [槽位系统 §9](./槽位系统-脚本到JSON.md)：
  + **P1** `backpack` / **P2** `seek` 等
  + **不做** `dmg_tame` 槽：驯服承伤改由 **脚本伤害事件** 替代后再删 `api:lv_*_tame`
+ JSON 侧决策/副作用（音效等）迁移：排在槽位基础系统之后，且不触动 `thlmm:` 命名
