# Task6 Phase 0：仇恨清除 — 手动测试步骤

**目的：** 对比三种清恨路径，决定正式 Seek 是否依赖 `api:reset_target` / `reevaluate_description`。  
**探针：** `debug_fairy`（临时索敌组）+ `debug_target_2`；脚本 `SeekHateClearTest`。  
**状态：** 主矩阵 A–E 已测完定稿；**探针代码已移出行为包**，快照见 [Phase0-探针归档/](./Phase0-探针归档/README.md)。  
**注意：** 测时曾改 `debug_fairy`（默认不索敌玩家，仅探针事件挂索敌）；现已恢复仓库原版。复测按归档 README 临时挂回即可。

---

## 准备（历史步骤；当前 BP 已无探针）

1. （归档复测）按 [Phase0-探针归档/README.md](./Phase0-探针归档/README.md) 临时恢复代码与 `debug_fairy`。
2. 编译并同步行为包 / 脚本（`cd TouHouLittleMaid_BP/typescripts && npx tsc`，确认 `scripts/` 已更新）。
3. 进世界应看到 `Addon Loaded!`；内容日志可搜 `SeekHateClearTest` / `registered seek_hate_*`。
4. 聊天执行（须由**玩家**执行，保证 `sourceEntity` 存在）：
   ```
   /scriptevent thlm:test seek_hate_help
   ```
   聊天应出现命令列表。若完全无回显：确认已看到 `Addon Loaded!`、行为包脚本已同步，并重进世界。若提示 `unknown` / 未知子命令，说明 message 未命中注册表。

---

## 用例 A — 基线：能锁上目标

```
/scriptevent thlm:test seek_hate_setup
```

等待约 1～2 秒：

```
/scriptevent thlm:test seek_hate_status
```

**期望：** `hate=` 指向 `debug_target_2`（非 `undefined`）；妖精朝目标移动/尝试远程攻击。

失败则检查：目标是否在 32 格内、是否被方块挡住（本探针 `must_see:false`）、包是否刷新。

---

## 用例 B — 仅 `reset_target`（保留索敌组）

在 A 已锁定后：

```
/scriptevent thlm:test seek_hate_reset
/scriptevent thlm:test seek_hate_status
```

1～3 秒后再 `status` 一次。

| 观察 | 含义 |
| --- | --- |
| 立即 `hate=undefined`，之后又锁回同一目标 | `reset_target` 有效，但索敌仍在会重选 |
| 立即清空且长时间不回来 | 意外（目标应仍 value=9） |
| 完全不清 | `reset_target` 无效或事件未触发 |

**记录（2026-09-30）：** `seek_hate_reset` 后立刻 `status` → `hate` 仍为同一 `debug_target_2`（未见 `undefined`）。  
在 sticky 仍挂载且目标 `value=9` 合法时，**无法区分**「`reset_target` 无效」与「清空后同 tick/极短时间内重选」。正式结论等用例 C（卸组）对照。

---

## 用例 C — 卸索敌组件组（`probe:seek_off`）

重新 `seek_hate_setup`（或 `seek_hate_sticky` 确保有恨）后：

```
/scriptevent thlm:test seek_hate_quit
/scriptevent thlm:test seek_hate_status
```

数秒后再 `status`。

**记录（2026-09-30）：** `probe:seek_off` 后立刻 `status` → `hate` **仍为**同一 `debug_target_2`（残留仇恨）。与 B 对照：仅卸组不够；退出 Seek **必须叠加** `api:reset_target`（B 单独 reset 在 sticky 仍挂时会被重选掩盖，但 C 证明恨不会随卸组自动清）。

---

## 用例 D — sticky 组下改属性（`value: 9→-1`）

`setup` 锁定后：

```
/scriptevent thlm:test seek_hate_value_bad
```

脚本会在约 0.25s 与 2s 自动 `status`；也可手动再打。

| 观察 | 含义 |
| --- | --- |
| 立刻丢目标 | sticky 也会因无效目标丢掉（或 scan 很快） |
| 约 5s 内仍咬住（对齐 `persist_time:5`） | 属性过滤未即时失效 |
| 一直不丢 | 需 `reset_target` / 卸组 |

**记录（2026-09-30）：** `value=-1` 后约 0.25s 与 2s 的 `status` 均仍 `hate=debug_target_2`（过滤器已不满足，恨未丢）。窗口短于 `persist_time:5`，故归为「sticky 属性过滤不即时失效」；释放锁 **不能**只靠改 `thlmt:value`，须显式 `reset_target`（及卸组，见 C）。`value_ok` 后仍咬同一目标（本就未丢）。

---

## 用例 E — reeval 组下改属性

```
/scriptevent thlm:test seek_hate_setup
/scriptevent thlm:test seek_hate_reeval
```

等再次锁上后：

```
/scriptevent thlm:test seek_hate_value_bad
```

对比用例 D：`reevaluate_description:true` + `persist_time:0` 是否明显更快丢恨。

**记录（2026-09-30）：** 切到 `probe:seek_reeval` 后仍能锁上；`value=-1` 后约 0.25s 即 `hate=undefined`，2s 仍为空。与 D 对比：**reeval 使属性失效即时丢恨**。

---

## 用例 F — reeval 下卸组 / reset（可选）

在 reeval 挂载且有恨时，分别再跑一遍 B、C，看与 sticky 是否一致。

---

## 清理

```
/scriptevent thlm:test seek_hate_cleanup
```

---

## 结果记录（请填）

| 用例 | 结果摘要 | 对正式 Seek 的建议 |
| --- | --- | --- |
| A 基线锁定 | **通过**：setup 后 `hate=debug_target_2`，`target.value=9` | sticky 过滤器可用，基线成立 |
| B 仅 reset_target | **status 未见清恨**：reset 后仍咬同一目标 | sticky 仍挂时 reset 会被重选掩盖；不能单独当「持续清恨」 |
| C 仅卸组 | **残留仇恨**：`seek_off` 后 `hate` 仍为同一目标 | **退出 Seek = 卸组 + `api:reset_target`**（两者都要） |
| D sticky + value=-1 | **≤2s 不丢恨**：value 已是 -1，`hate` 仍指向该目标 | sticky 下改属性≠即时清恨；stamp/release 不能只改 value |
| E reeval + value=-1 | **约 0.25s 丢恨**：`hate=undefined` 且保持 | Seek 正式配置采用 `reevaluate_description:true` + `persist_time:0` |

**建议定稿规则（填完后勾）：**

- [x] 退出 Seek / 释放锁时：**必须**调用 `api:reset_target`（C 已证实仅卸组有残留恨）
- [x] Seek 过滤器采用 `reevaluate_description: true` + `persist_time: 0`（E 已证实；对比 D sticky 不即时）
- [x] 其它：仅改 `thlmt:value` **不足以**即时清恨（D）；退出路径以 **卸组 + reset_target** 为准（C）；reeval 辅助属性失效时加速丢恨（E）

### 通俗结论（给人看）

1. **关掉索敌，不等于忘掉目标**  
   把索敌组件卸掉之后，妖精心里还记着刚才那个目标（`Entity.target` 还在）。所以以后正式退出 Seek，不能只卸组件，还要再触发一次 `reset_target` 把仇恨清掉。两样都要。

2. **只改目标身上的数字，也不保证马上松手**  
   把目标的 `thlmt:value` 从 9 改成 -1（按理说已经不该被锁定了），在「粘性」索敌配置下，一两秒内它还在咬着。所以释放锁不能只靠改属性，还是要靠显式清恨。

3. **索敌要开「会重新检查条件」那种**  
   换成 `reevaluate_description: true` + `persist_time: 0` 之后，同样改成 -1，大约 0.25 秒仇恨就空了。正式 Seek 就用这套配置，属性一失效能更快松手。

另外顺带确认了：**按属性过滤去锁目标这条路是通的**（能稳定锁上 `debug_target_2`）。

一句话：  
**锁得上；松手时要「卸索敌 + reset_target」；Seek 要用会重评过滤器的配置，不能指望只改属性就立刻清恨。**

**Phase 0 主矩阵 A–E 已完成。** 用例 F 可选；结论已回写 [huh.md](./huh.md)，可进入 Phase 1。
