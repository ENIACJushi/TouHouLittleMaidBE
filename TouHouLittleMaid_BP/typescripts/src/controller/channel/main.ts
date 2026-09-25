/**
 * 跨行为包通信模块入口。
 *
 * - ChannelReceiver：主包接收 / 短 id 分配
 * - ChannelSender：附加包发送（可连同 Protocol 复制到副包）
 * - ChannelProtocol：帧格式与常量
 */
export {
  CHANNEL_CTRL_NS,
  CHANNEL_DATA_NS,
  CTRL_REGISTER,
  CTRL_ASSIGN,
  CTRL_UNREGISTER,
  MAX_CHUNK_CHARS,
  MAX_FRAME_MESSAGE_CHARS,
  UUID_LEN,
  SENDER_ID_LEN,
  type ChannelMessageHandler,
  type ChannelMessageMeta,
} from './ChannelProtocol';
export { ChannelReceiver } from './ChannelReceiver';
export { ChannelSender } from './ChannelSender';
