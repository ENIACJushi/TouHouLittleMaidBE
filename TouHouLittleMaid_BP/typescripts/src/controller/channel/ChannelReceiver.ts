import { ScriptEventCommandMessageAfterEvent, system } from '@minecraft/server';
import { Logger } from '../Logger';
import {
  CHANNEL_CTRL_NS,
  CHANNEL_DATA_NS,
  CTRL_ASSIGN,
  CTRL_REGISTER,
  CTRL_UNREGISTER,
  ChannelMessageHandler,
  ChannelMessageMeta,
  DecodedDataFrame,
  GROUP_ASSEMBLE_TIMEOUT_TICKS,
  SENDER_ID_LEN,
  decodeDataFrame,
  encodeAssignMessage,
  isValidTopic,
  isValidUuid,
  padDecimal,
  parseDataTopic,
} from './ChannelProtocol';

const TAG = 'ChannelReceiver';

/** 短 id 池上限（0000～9999） */
const SENDER_ID_MAX = 10000;

/**
 * 正在拼装的分片组。
 * 使用场景：同一 senderId+groupId 的多帧 thlmd 聚合，收齐后回调业务。
 */
type AssemblingGroup = {
  topic: string;
  senderId: string;
  groupId: string;
  total: number;
  chunks: (string | undefined)[];
  received: number;
  lastTick: number;
};

/**
 * 主行为包唯一接收端。
 *
 * 职责：uuid→短 senderId 分配/回收；数据面拼包；按 topic 分发。
 * 在 WorldEvents 中 start()；业务用 on(topic, handler) 挂接。
 */
export class ChannelReceiver {
  private static started = false;

  /** uuid → senderId */
  private static uuidToSender = new Map<string, string>();

  /** senderId → uuid */
  private static senderToUuid = new Map<string, string>();

  /** 注销后可复用的短号 */
  private static freeSenderIds: string[] = [];

  /** 下一个自增候选（0～9999） */
  private static nextSenderSeq = 0;

  private static handlers = new Map<string, ChannelMessageHandler[]>();

  /** `${senderId},${groupId}` → 拼装中 */
  private static groups = new Map<string, AssemblingGroup>();

  /**
   * 启动接收端（幂等）。
   */
  static start(): void {
    if (ChannelReceiver.started) {
      return;
    }
    ChannelReceiver.started = true;

    system.afterEvents.scriptEventReceive.subscribe(
      (event) => {
        system.run(() => {
          ChannelReceiver.onScriptEvent(event);
        });
      },
      { namespaces: [CHANNEL_CTRL_NS, CHANNEL_DATA_NS] }
    );

    system.runInterval(() => {
      ChannelReceiver.purgeExpiredGroups();
    }, 20);

    Logger.info(TAG, '跨包通信接收端已启动');
  }

  /**
   * 注册 topic 业务回调；同一 topic 可挂多个，按顺序调用。
   */
  static on(topic: string, handler: ChannelMessageHandler): void {
    if (!isValidTopic(topic)) {
      Logger.warn(TAG, `拒绝注册非法 topic: ${topic}`);
      return;
    }
    const list = ChannelReceiver.handlers.get(topic);
    if (list === undefined) {
      ChannelReceiver.handlers.set(topic, [handler]);
    } else {
      list.push(handler);
    }
  }

  /**
   * 查询 uuid 当前短号（调试用）。
   */
  static getSenderId(uuid: string): string | undefined {
    return ChannelReceiver.uuidToSender.get(uuid);
  }

  private static onScriptEvent(event: ScriptEventCommandMessageAfterEvent): void {
    if (event.id === CTRL_REGISTER) {
      ChannelReceiver.handleRegister(event.message);
      return;
    }
    if (event.id === CTRL_UNREGISTER) {
      ChannelReceiver.handleUnregister(event.message);
      return;
    }
    const topic = parseDataTopic(event.id);
    if (topic !== undefined) {
      ChannelReceiver.handleDataFrame(topic, event.message);
    }
  }

  /**
   * 处理副包 register：分配或幂等重发 assign。
   */
  private static handleRegister(uuid: string): void {
    if (!isValidUuid(uuid)) {
      Logger.warn(TAG, `忽略非法 uuid register: ${uuid}`);
      return;
    }

    const existing = ChannelReceiver.uuidToSender.get(uuid);
    if (existing !== undefined) {
      ChannelReceiver.broadcastAssign(existing, uuid);
      return;
    }

    const senderId = ChannelReceiver.allocateSenderId();
    if (senderId === undefined) {
      Logger.warn(TAG, `短 id 号池耗尽，无法分配: ${uuid}`);
      return;
    }

    ChannelReceiver.uuidToSender.set(uuid, senderId);
    ChannelReceiver.senderToUuid.set(senderId, uuid);
    ChannelReceiver.broadcastAssign(senderId, uuid);
    Logger.debug(TAG, `已分配 senderId=${senderId} uuid=${uuid}`);
  }

  /**
   * 处理 unregister：释放短号并丢弃该号未完成拼包。
   */
  private static handleUnregister(uuid: string): void {
    if (!isValidUuid(uuid)) {
      return;
    }
    const senderId = ChannelReceiver.uuidToSender.get(uuid);
    if (senderId === undefined) {
      return;
    }
    ChannelReceiver.uuidToSender.delete(uuid);
    ChannelReceiver.senderToUuid.delete(senderId);
    ChannelReceiver.freeSenderIds.push(senderId);
    ChannelReceiver.dropGroupsForSender(senderId);
    Logger.debug(TAG, `已注销 senderId=${senderId} uuid=${uuid}`);
  }

  /**
   * 从空闲池或自增序列取一个短号；耗尽返回 undefined。
   */
  private static allocateSenderId(): string | undefined {
    const recycled = ChannelReceiver.freeSenderIds.pop();
    if (recycled !== undefined) {
      return recycled;
    }
    if (ChannelReceiver.nextSenderSeq >= SENDER_ID_MAX) {
      return undefined;
    }
    const id = padDecimal(ChannelReceiver.nextSenderSeq, SENDER_ID_LEN);
    ChannelReceiver.nextSenderSeq++;
    return id;
  }

  private static broadcastAssign(senderId: string, uuid: string): void {
    try {
      system.sendScriptEvent(CTRL_ASSIGN, encodeAssignMessage(senderId, uuid));
    } catch (e) {
      Logger.error(TAG, `assign 发送失败: ${String(e)}`);
    }
  }

  private static handleDataFrame(topic: string, message: string): void {
    const frame = decodeDataFrame(message);
    if (frame === undefined) {
      Logger.warn(TAG, `无法解析数据帧 topic=${topic}`);
      return;
    }

    if (!ChannelReceiver.senderToUuid.has(frame.senderId)) {
      Logger.debug(
        TAG,
        `丢弃未登记 senderId 的数据: ${frame.senderId} topic=${topic}`
      );
      return;
    }

    const key = ChannelReceiver.groupKey(frame.senderId, frame.groupId);
    let group = ChannelReceiver.groups.get(key);
    const now = system.currentTick;

    if (group === undefined) {
      group = {
        topic,
        senderId: frame.senderId,
        groupId: frame.groupId,
        total: frame.total,
        chunks: new Array(frame.total),
        received: 0,
        lastTick: now,
      };
      ChannelReceiver.groups.set(key, group);
    } else if (
      group.topic !== topic ||
      group.total !== frame.total ||
      group.senderId !== frame.senderId
    ) {
      Logger.warn(TAG, `分片组元数据冲突，丢弃: ${key}`);
      ChannelReceiver.groups.delete(key);
      return;
    } else {
      group.lastTick = now;
    }

    ChannelReceiver.applyChunk(group, frame, key);
  }

  private static applyChunk(
    group: AssemblingGroup,
    frame: DecodedDataFrame,
    key: string
  ): void {
    if (frame.index >= group.total) {
      return;
    }
    if (group.chunks[frame.index] !== undefined) {
      return;
    }
    group.chunks[frame.index] = frame.chunk;
    group.received++;

    if (group.received < group.total) {
      return;
    }

    ChannelReceiver.groups.delete(key);
    const payload = group.chunks.join('');
    const uuid = ChannelReceiver.senderToUuid.get(group.senderId);
    const meta: ChannelMessageMeta = {
      senderId: group.senderId,
      uuid,
      groupId: group.groupId,
      topic: group.topic,
    };
    ChannelReceiver.dispatch(group.topic, payload, meta);
  }

  private static dispatch(
    topic: string,
    payload: string,
    meta: ChannelMessageMeta
  ): void {
    const list = ChannelReceiver.handlers.get(topic);
    if (list === undefined || list.length === 0) {
      Logger.warn(
        TAG,
        `无 handler，丢弃已收齐消息: topic=${topic} len=${payload.length}`
      );
      return;
    }
    for (const handler of list) {
      try {
        handler(payload, meta);
      } catch (e) {
        Logger.error(TAG, `topic=${topic} handler 异常: ${String(e)}`);
      }
    }
  }

  private static groupKey(senderId: string, groupId: string): string {
    return `${senderId},${groupId}`;
  }

  /**
   * 丢弃某 senderId 下所有未完成拼包（unregister 时调用）。
   */
  private static dropGroupsForSender(senderId: string): void {
    const prefix = `${senderId},`;
    const toDelete: string[] = [];
    for (const key of ChannelReceiver.groups.keys()) {
      if (key.startsWith(prefix)) {
        toDelete.push(key);
      }
    }
    for (const key of toDelete) {
      ChannelReceiver.groups.delete(key);
    }
  }

  private static purgeExpiredGroups(): void {
    if (ChannelReceiver.groups.size === 0) {
      return;
    }
    const now = system.currentTick;
    for (const [key, group] of ChannelReceiver.groups) {
      if (now - group.lastTick >= GROUP_ASSEMBLE_TIMEOUT_TICKS) {
        ChannelReceiver.groups.delete(key);
        Logger.warn(
          TAG,
          `分片组超时丢弃: ${key} topic=${group.topic} ${group.received}/${group.total}`
        );
      }
    }
  }
}
