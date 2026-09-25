# 行为包通信

## 基础通信模块

多发送 → 单接收。设计见 [基础通信模块设计.md](./基础通信模块设计.md)。  
实现：`typescripts/src/controller/channel/`（`WorldEvents` 已 `ChannelReceiver.start()`）。

副包 uuid 周期 `register` → 主包 `assign`（4 位数字 id + uuid）→ 再发数据；可选 `unregister`。

## 皮肤包数据通信

输入框长度有限，附加行为包较急，依赖上述通道。

**主包**：`SkinPackChannel` 监听 topic `skin`，载荷与管理面板相同（整表替换并写动态属性）。

```ts
// 副包示例（脚本入口）
import { ChannelSender } from '...'; // 复制 channel 模块或同源依赖
const sender = new ChannelSender();
sender.send('skin', JSON.stringify({
  skin: [{ count: 20 }],
  chair: [{ count: 10, heights: [3, 15] }],
}));
// 一次性注册可在 whenReady 发完后 sender.unregister();
```

载荷格式：
- 新：`{"skin":[...],"chair":[...]}`（可只含一侧）
- 旧：`[{"count":n},...]`（仅女仆）

语义：与面板提交相同，**整表替换** `extraPacks`；多副包需约定由一方发送完整列表（按包序号数组下标对应 1001+）。

## 农作数据通信

对外开放农作注册；放在农作相关改造之后更合适。
农作物虽然没有一次性传递大量数据的需求，但是保证副包在主包之后加载还是需要的。
