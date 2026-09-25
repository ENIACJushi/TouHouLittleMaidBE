/**
 * 跨行为包通信协议：常量、编解码与分片。
 *
 * 使用场景：附加包 ChannelSender ↔ 主包 ChannelReceiver；
 * 控制面用 uuid 申请短 senderId，数据面用短 id 分片传字符串。
 * 本文件尽量无业务依赖，便于复制到副行为包。
 */

/** 控制面命名空间 */
export const CHANNEL_CTRL_NS = 'thlmc';

/** 数据面命名空间 */
export const CHANNEL_DATA_NS = 'thlmd';

export const CTRL_REGISTER = `${CHANNEL_CTRL_NS}:register`;
export const CTRL_ASSIGN = `${CHANNEL_CTRL_NS}:assign`;
export const CTRL_UNREGISTER = `${CHANNEL_CTRL_NS}:unregister`;

/** uuid 长度（小写 hex，无连字符） */
export const UUID_LEN = 32;

/** 短 senderId 位数（十进制 0000～9999） */
export const SENDER_ID_LEN = 4;

/** groupId 位数（hex） */
export const GROUP_ID_LEN = 4;

/** total / index 定长十进制位数 */
export const CHUNK_COUNT_DIGITS = 4;

/** assign 整包长度：senderId + uuid */
export const ASSIGN_MESSAGE_LEN = SENDER_ID_LEN + UUID_LEN;

/** 数据帧头长度 */
export const FRAME_HEADER_LEN =
  SENDER_ID_LEN + GROUP_ID_LEN + CHUNK_COUNT_DIGITS + CHUNK_COUNT_DIGITS;

/** 单帧 message 字符上限（保守对齐 scriptevent 量级） */
export const MAX_FRAME_MESSAGE_CHARS = 2000;

/** 单片正文最大字符数 */
export const MAX_CHUNK_CHARS = MAX_FRAME_MESSAGE_CHARS - FRAME_HEADER_LEN;

/** 拼包超时（tick） */
export const GROUP_ASSEMBLE_TIMEOUT_TICKS = 100;

/** register：首次后的起始等待（tick） */
export const REGISTER_RETRY_INITIAL_DELAY = 20;

/** register：单次等待与累计等待上限（tick，= 5 min） */
export const REGISTER_RETRY_MAX_TICKS = 6000;

/** topic 允许格式 */
const TOPIC_PATTERN = /^[a-zA-Z0-9_]{1,32}$/;

const HEX_CHARS = '0123456789abcdef';

/**
 * 收齐后交给业务的元数据。
 */
export type ChannelMessageMeta = {
  /** 主包分配的短 id */
  senderId: string;
  /** 副包 uuid（映射表中有则带上） */
  uuid?: string;
  /** 本条逻辑消息的分组 id */
  groupId: string;
  /** 业务通道 */
  topic: string;
};

export type ChannelMessageHandler = (
  payload: string,
  meta: ChannelMessageMeta
) => void;

/**
 * 校验 topic。
 */
export function isValidTopic(topic: string): boolean {
  return TOPIC_PATTERN.test(topic);
}

/**
 * 校验 32 位小写 hex uuid。
 */
export function isValidUuid(uuid: string): boolean {
  if (uuid.length !== UUID_LEN) {
    return false;
  }
  return /^[0-9a-f]{32}$/.test(uuid);
}

/**
 * 校验 4 位十进制 senderId。
 */
export function isValidSenderId(senderId: string): boolean {
  return /^[0-9]{4}$/.test(senderId);
}

/**
 * 生成 32 位小写 hex uuid（16 字节随机）。
 * Bedrock 无稳定 CSPRNG，用 Math.random 足够应付少量附加包防撞。
 */
export function generateUuid(): string {
  let out = '';
  for (let i = 0; i < UUID_LEN; i++) {
    out += HEX_CHARS[Math.floor(Math.random() * 16)];
  }
  return out;
}

/**
 * 将非负整数格式化为定长十进制（左侧补 0）。
 */
export function padDecimal(value: number, digits: number): string {
  const s = String(value);
  if (s.length > digits) {
    throw new Error(`ChannelProtocol: 数值 ${value} 超过 ${digits} 位`);
  }
  let pad = '';
  for (let i = s.length; i < digits; i++) {
    pad += '0';
  }
  return pad + s;
}

/**
 * 将 0～65535 格式化为 4 位小写 hex。
 */
export function padHex4(value: number): string {
  const n = ((value % 65536) + 65536) % 65536;
  let s = n.toString(16);
  while (s.length < 4) {
    s = '0' + s;
  }
  return s;
}

/**
 * 编码 assign message：senderId(4) + uuid(32)。
 */
export function encodeAssignMessage(senderId: string, uuid: string): string {
  return senderId + uuid;
}

/**
 * 解析 assign；非法则返回 undefined。
 */
export function decodeAssignMessage(
  message: string
): { senderId: string; uuid: string } | undefined {
  if (message.length !== ASSIGN_MESSAGE_LEN) {
    return undefined;
  }
  const senderId = message.slice(0, SENDER_ID_LEN);
  const uuid = message.slice(SENDER_ID_LEN);
  if (!isValidSenderId(senderId) || !isValidUuid(uuid)) {
    return undefined;
  }
  return { senderId, uuid };
}

/**
 * 编码一帧数据 message。
 */
export function encodeDataFrame(
  senderId: string,
  groupId: string,
  total: number,
  index: number,
  chunk: string
): string {
  return (
    senderId +
    groupId +
    padDecimal(total, CHUNK_COUNT_DIGITS) +
    padDecimal(index, CHUNK_COUNT_DIGITS) +
    chunk
  );
}

export type DecodedDataFrame = {
  senderId: string;
  groupId: string;
  total: number;
  index: number;
  chunk: string;
};

/**
 * 解码数据帧；失败返回 undefined。
 */
export function decodeDataFrame(message: string): DecodedDataFrame | undefined {
  if (message.length < FRAME_HEADER_LEN) {
    return undefined;
  }
  const senderId = message.slice(0, SENDER_ID_LEN);
  const groupId = message.slice(SENDER_ID_LEN, SENDER_ID_LEN + GROUP_ID_LEN);
  if (!isValidSenderId(senderId) || !/^[0-9a-f]{4}$/.test(groupId)) {
    return undefined;
  }
  const totalStart = SENDER_ID_LEN + GROUP_ID_LEN;
  const indexStart = totalStart + CHUNK_COUNT_DIGITS;
  const totalStr = message.slice(totalStart, indexStart);
  const indexStr = message.slice(indexStart, indexStart + CHUNK_COUNT_DIGITS);
  if (!/^\d{4}$/.test(totalStr) || !/^\d{4}$/.test(indexStr)) {
    return undefined;
  }
  const total = Number(totalStr);
  const index = Number(indexStr);
  if (total < 1 || index < 0 || index >= total) {
    return undefined;
  }
  return {
    senderId,
    groupId,
    total,
    index,
    chunk: message.slice(indexStart + CHUNK_COUNT_DIGITS),
  };
}

/**
 * 按字符上限切分 payload（空串仍返回一帧空 chunk）。
 */
export function splitPayload(payload: string): string[] {
  if (payload.length === 0) {
    return [''];
  }
  const chunks: string[] = [];
  for (let i = 0; i < payload.length; i += MAX_CHUNK_CHARS) {
    chunks.push(payload.slice(i, i + MAX_CHUNK_CHARS));
  }
  const maxChunks = 10 ** CHUNK_COUNT_DIGITS - 1;
  if (chunks.length > maxChunks) {
    throw new Error(
      `ChannelProtocol: 分片数 ${chunks.length} 超过上限 ${maxChunks}`
    );
  }
  return chunks;
}

/**
 * 组装数据面 event.id。
 */
export function dataEventId(topic: string): string {
  return `${CHANNEL_DATA_NS}:${topic}`;
}

/**
 * 从 event.id 解析 topic。
 */
export function parseDataTopic(eventId: string): string | undefined {
  const prefix = `${CHANNEL_DATA_NS}:`;
  if (!eventId.startsWith(prefix)) {
    return undefined;
  }
  const topic = eventId.slice(prefix.length);
  if (!isValidTopic(topic)) {
    return undefined;
  }
  return topic;
}
