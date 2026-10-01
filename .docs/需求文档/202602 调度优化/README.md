## 女仆调度优化

已完成 Task1～Task5 的变更摘要：[更新日志.md](./更新日志.md)

### 任务总览

首要目标
+ [x] Task1 优化代码结构，包括 TS 化全部文件，从女仆本体开始，然后覆盖周边模块
+ [x] Task2 将 JSON 执行的决策和动作（如播放音效）等尽量移到脚本侧
  + [x] 槽位系统 + Level basic 迁槽并删旧 `lv*_basic`（已验证可兼容，删旧惯例见 Task2 槽位文档 §6.1）
  + [x] 其它系统（Seek）评估为当前没必要改动
+ [x] Task3 将音效全权交由脚本播放，为音效包铺路
  + 通道收拢与调研已完成；补齐音效 / 音效包 / 转换器 → [音效优化二期](../音效优化二期/README.md)
+ [x] Task4 优化附加包注册，输入框只能输入101个字符，考虑添加副行为包
  + 已实现跨行为包通信模块（`controller/channel/`）；皮肤包经转换器 `.mcaddon` 自动注册
  + 农作注册等其它 topic 接线：随后续农作改造再做
+ [x] Task5 将伤害处理全权交由脚本执行，为护甲和饰品铺路（含替代 `api:lv_*_tame`）
  + 见 [Task5](./Task5%20伤害转移至脚本处理/huh.md)；减伤经 `/scriptevent thlm:test dmg` 等脚本验收通过
+ [x] Task6 精准目标 **控制系统**（暂不接入农作等业务）
  + [huh](./Task6%20精准目标控制/huh.md) / [实现计划](./Task6%20精准目标控制/实现计划.md)
  + 交付：精简 Seek、`thlmt:value` 锁协议、脚本门面、`reset_target`、debug 验收
  + **不改** 现网 `mode:farm` / `Farm.ts` 等；农作接入刚需 Task7
+ [] Task7 脚本寻路 + 农作接入精准目标（**Task6 已完成**）
  + [huh](./Task7%20优化寻路方案/huh.md) / [实现计划](./Task7%20优化寻路方案/实现计划.md)
  + Phase0a：**谓词已锁定** → [测试设计](./Task7%20优化寻路方案/Phase0a-可站立与可穿过测试设计.md)；探针归档 → [Phase0a-探针归档](./Task7%20优化寻路方案/Phase0a-探针归档/README.md)
  + 生产：`maid/path`（`StandableCache` / `blockPredicates`）；下一步四类边 + A\*
+ [] 加入背包保留功能
+ [] 加入饰品栏
  + 卡点调研：[饰品栏/huh.md](./饰品栏/huh.md)
  + 结论：实体 `inventory` **无**按格白名单；`ContainerRules` 整容器且只读（偏 Bundle）；原生按格仅 `equippable.accepted_items`
  + 推荐：预留格 + 脚本纠错（兼容查包）；并行探针 equippable；勿指望给女仆库存设 Rules
  + 考虑将女仆捡物品也交给脚本执行，这样还可以为之后捡经验和p点铺路

次要目标
+ [] 优化工作模式组织方式，采用更灵活的注册模式替代现有的固定列表
