# 精准目标控制

**范围（收窄）：** 只实现 **精准目标控制系统**（Seek 槽、锁协议、脚本门面、清恨、debug 验收）。  
**暂不接入** 农作 / 其它工作模式；现网 `mode:farm` 等 family 共享索敌保持不变。

**后续：** 农作使用本系统 **刚需 Task7 脚本寻路**（预判可达，避免独占锁死）。顺序：Task6 基建 → Task7 寻路 → 再改 `Farm` 等接入。

### 已拍板

| 项 | 决定 |
| --- | --- |
| Seek 容量 | **256**（`0..255`） |
| 事件名 | **`slot:seek_<n>` / `_quit`**；删除未使用的旧 `tlm_seek:*` / `seek:*` |
| 目标实体 | 新增 **`thlmt:seek_marker`**（日后正式目标点也用它） |
| Phase 0 | **已完成**；步骤/结果 → [Phase0-仇恨清除手动测试.md](./Phase0-仇恨清除手动测试.md)；探针代码归档 → [Phase0-探针归档/](./Phase0-探针归档/README.md) |

**Phase 0 通俗结论：** 锁得上；松手要「卸索敌 + `reset_target`」；Seek 用会重评过滤器的配置（`reevaluate_description: true` + `persist_time: 0`），不能指望只改 `thlmt:value` 就立刻清恨。详见该文档「通俗结论」一节。

---

## 调研结论（卡点：单女仆独占锁定）

### 脚本侧做不到什么

+ `Entity.target`：**只读**（`read-only target?: Entity`）。不能 `maid.target = xxx` 指定仇恨。
+ 无独立 `setTarget` / `clearTarget` Script API；清恨用 JSON 事件动作 `reset_target`（`{ "reset_target": {} }`），当前女仆实体 **尚未声明** 该事件。

### 平台过滤器硬约束

+ `nearest_attackable_target` 的 `int_property` / `has_tag` 等只能与 **字面量** 比较，不能「匹配自己某属性」。
+ 因此「一目标实体 + 改属性实现独占」可行，但 **女仆侧必须预生成 N 档索敌组件**——无法靠脚本动态过滤器消掉。

### 现成证据

| 位置 | 说明 |
| --- | --- |
| `MaidGenerator/modules/Seek.js` + 已生成进 `maid.json` | `seek:i` 过滤 `thlmt:value==i`（0～300）；含多余 `ranged_attack`；`tlm_seek:*` **脚本从未调用** |
| `entities/maid_target/debug_target_2.json` + `debug_fairy.json` | 原型：目标有 `thlmt:value`，妖精过滤器 `value: 9` |
| `mode:farm` 等 + `thlmt:farm` 等 | 生产仍按 `is_family` 共享索敌（**本任务不改**） |
| `Farm.ts` 冷却重建 | 「必须新建一个，否则仇恨无法消除」→ 侧面说明卸状态/改实体不一定清恨 |

### 采用方法（本任务交付）

通过属性过滤器筛选目标：目标实体带 `thlmt:value`，改属性保证只被一个女仆锁定。  
女仆侧 N 档索敌由生成器维护；Seek 精简结构 + 脚本门面接线。

配套（系统层）：

1. Seek 组 **只留索敌**，不捆绑攻击组件
2. 显式 `api:reset_target`；Seek 开 `reevaluate_description` + 低 `persist_time`（**Phase 0 已实测定稿**）
   - **已验证（C）：** 仅卸 Seek 组后 `Entity.target` **仍残留**原目标 → `quit`/`release` **必须** `卸组 + reset_target`
   - **已验证（D）：** sticky（`reevaluate_description:false` / `persist_time:5`）下把目标 `value` 改为 -1，约 2s 内 `Entity.target` **仍残留** → 释放锁不能只改属性
   - **已验证（E）：** reeval（`reevaluate_description:true` / `persist_time:0`）下 `value=-1` 约 0.25s 即 `hate=undefined` → 正式 Seek **采用该配置**
3. 脚本：`allocate` / `mount` / `quit` / `stamp` / `release` / `resetTarget`
4. **不**改工作 `mode:*` 的 family 索敌；**不**改 `Farm` / `Melon` / … 放置逻辑

详细分阶段见 [实现计划.md](./实现计划.md)。

---

## 调研结论（卡点：可达性）— 农作接入时再硬刚

生产无 `canReach` API。Task6 **只**在 Seek 配置上保留 `must_reach: true` 与清恨能力，供后续接入使用。

农作接入时的完整策略（超时不可达、A\* 预判）见：

- 本任务实现计划中「移出 / 后置」说明
- [Task7 优化寻路方案](../Task7%20优化寻路方案/huh.md)（**农作精准目标刚需**）
