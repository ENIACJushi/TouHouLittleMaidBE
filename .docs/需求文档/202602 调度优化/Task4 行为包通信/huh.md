# 行为包通信

> 状态：**已完成**（皮肤附加包注册）。农作等其它 topic 见文末，随后续改造再接线。

## 基础通信模块

多发送 → 单接收。设计见 [基础通信模块设计.md](./基础通信模块设计.md)。  
实现：`typescripts/src/controller/channel/`（`WorldEvents` 已 `ChannelReceiver.start()`）。

副包 uuid 周期 `register` → 主包 `assign`（4 位数字 id + uuid）→ 再发数据；可选 `unregister`。

## 皮肤包数据通信

皮肤配置需跨包传递，依赖上述通道。

转换器导出 `.mcaddon`（RP + 自动注册 BP）。主包 `SkinPackChannel` 监听 topic `skin`，脚本进世界后自动整表替换并写动态属性。

**转换器产物**：

- `TLM_MaidSkinPack_RP/`：资源包；manifest 依赖主 RP + 本 BP  
- `TLM_MaidSkinPack_BP/`：脚本；稳定 `channelUuid`（由资源包 UUID 派生）；依赖本 RP + 主 BP + `@minecraft/server@1.18.0`  
- 流程：`register` → `assign` → `send('skin', …)` → `unregister`  
- `min_engine_version`：`[1, 21, 70]`

载荷格式：
- `{"skin":[...],"chair":[...]}`（可只含一侧）
- 亦接受 `[{"count":n},...]`（仅女仆）

语义：**整表替换** `extraPacks`；多副包需约定由一方发送完整列表（数组下标对应 1001+）。

## 农作数据通信

对外开放农作注册；放在农作相关改造之后更合适。
农作物虽然没有一次性传递大量数据的需求，但是保证副包在主包之后加载还是需要的。
