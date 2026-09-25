import { Logger } from './Logger';
import {
  ChannelMessageMeta,
  ChannelReceiver,
} from './channel/main';
import {
  applyCombinedPackConfig,
  parseCombinedPackConfig,
} from './CombinedPackConfig';

const TAG = 'SkinPackChannel';

/**
 * 皮肤 / 坐垫附加包跨行为包注册。
 *
 * 使用场景：副行为包在加载后通过 ChannelSender.send('skin', json) 投递
 * 与管理面板相同的网站导出 JSON，绕过表单约 101 字符限制。
 * 语义为整表替换（与粘贴提交一致）；多副包需自行约定由谁发送完整列表。
 */
export class SkinPackChannel {
  /** 通道 topic，与设计文档一致 */
  static readonly TOPIC = 'skin';

  /**
   * 向 ChannelReceiver 挂接 handler；应在 start() 之后尽早调用。
   */
  static register(): void {
    ChannelReceiver.on(SkinPackChannel.TOPIC, (payload, meta) => {
      SkinPackChannel.onPayload(payload, meta);
    });
    Logger.info(TAG, `已监听 topic=${SkinPackChannel.TOPIC}`);
  }

  /**
   * 处理一条完整 skin 载荷。
   */
  private static onPayload(payload: string, meta: ChannelMessageMeta): void {
    const combined = parseCombinedPackConfig(payload);
    if (combined === undefined) {
      Logger.warn(
        TAG,
        `JSON 无效，已忽略 sender=${meta.senderId} uuid=${meta.uuid ?? '?'} len=${payload.length}`
      );
      return;
    }
    applyCombinedPackConfig(combined);
    Logger.info(
      TAG,
      `已应用附加包配置 sender=${meta.senderId}` +
        ` skin=${combined.skin?.length ?? '-'} chair=${combined.chair?.length ?? '-'}`
    );
  }
}
