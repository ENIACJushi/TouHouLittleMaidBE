# Phase3 旧农作目标实体归档

生产包已不再包含这些实体（`5834a43` 从 `TouHouLittleMaid_BP/entities/maid_target/` 删除）。此处仅保留 JSON 快照，**勿拷回 BP 常驻**。

## 背景

旧农作靠批量刷 `thlmt:farm` / `sugar_cane` / `melon` / `cocoa` 标记 + 女仆 `mode:*` NAT 共享索敌。Task6 之后可精确指定目标，Task7 改为扫坐标 → 单点 `Path.follow`（`thlmt:seek_marker`）→ 到位收种。

## 内容（删除前提交父的快照）

| 文件 | identifier | 对应工作 |
| --- | --- | --- |
| `target_farm.json` | `thlmt:farm` | 耕地 |
| `target_sugar_cane.json` | `thlmt:sugar_cane` | 甘蔗 |
| `target_melon.json` | `thlmt:melon` | 瓜 |
| `target_cocoa.json` | `thlmt:cocoa` | 可可 |

## 代码侧现状（归档时）

| 工作 | 调度实现 | 旧实体 |
| --- | --- | --- |
| Farm | `Farm.ts`（可达场 + follow） | 已删出 BP |
| SugarCane | `CropRoute` + `SugarCane.ts` | 已删出 BP |
| Melon | `CropRoute` + `Melon.ts` | 已删出 BP |
| Cocoa | `CropRoute` + `Cocoa.ts` | 已删出 BP |

Maid 侧 `mode:farm` 等行为组件 / 退出事件亦在同提交去掉；`Work.isScriptWork` 覆盖上述四种。

## 勿恢复生产

旧档里若仍有这些 type 的残留实体，重进世界可能变为未知实体；不要为「兼容」把 JSON 加回行为包。新逻辑只认 `seek_marker`。
