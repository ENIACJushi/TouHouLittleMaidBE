# 行为包通信

## 基础通信模块

多发送 → 单接收。设计见 [基础通信模块设计.md](./基础通信模块设计.md)。  
实现：`typescripts/src/controller/channel/`（`WorldEvents` 已 `ChannelReceiver.start()`）。

副包 uuid 周期 `register` → 主包 `assign`（4 位数字 id + uuid）→ 再发数据；可选 `unregister`。

## 皮肤包数据通信

输入框长度有限，附加行为包较急，依赖上述通道。

**主包**：`SkinPackChannel` 监听 topic `skin`，载荷与管理面板相同（整表替换并写动态属性）。

**转换器**：网页附加包转换额外生成自动注册行为包，下载为 `.mcaddon`：

- `TLM_MaidSkinPack_RP/`：原资源包；manifest 依赖主 RP + 本 BP  
- `TLM_MaidSkinPack_BP/`：脚本模块；稳定 `channelUuid`（由资源包 UUID 派生）；manifest 依赖本 RP + 主 BP + `@minecraft/server@1.18.0`（`sendScriptEvent` 正式版最低）  
- 脚本加载后：`register` → `assign` → `send('skin', command.json)` → `unregister`  
- `min_engine_version`：`[1, 21, 70]`

```ts
// 手写副包示例
const sender = new ChannelSender(channelUuid32Hex);
sender.send('skin', JSON.stringify({
  skin: [{ count: 20 }],
  chair: [{ count: 10, heights: [3, 15] }],
}));
```

载荷格式：
- 新：`{"skin":[...],"chair":[...]}`（可只含一侧）
- 旧：`[{"count":n},...]`（仅女仆）

语义：与面板提交相同，**整表替换** `extraPacks`；多副包需约定由一方发送完整列表（按包序号数组下标对应 1001+）。

## 农作数据通信

对外开放农作注册；放在农作相关改造之后更合适。
农作物虽然没有一次性传递大量数据的需求，但是保证副包在主包之后加载还是需要的。
