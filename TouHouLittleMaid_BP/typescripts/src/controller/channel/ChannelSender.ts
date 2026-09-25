import { system } from '@minecraft/server';
import {
  CHANNEL_CTRL_NS,
  CTRL_ASSIGN,
  CTRL_REGISTER,
  CTRL_UNREGISTER,
  REGISTER_RETRY_INITIAL_DELAY,
  REGISTER_RETRY_MAX_TICKS,
  dataEventId,
  decodeAssignMessage,
  encodeDataFrame,
  generateUuid,
  isValidTopic,
  padHex4,
  splitPayload,
} from './ChannelProtocol';

const TAG = 'ChannelSender';

/**
 * 待发送队列项。
 * 使用场景：尚未分到短 id 时业务已调用 send，激活后按序刷出。
 */
type PendingSend = {
  topic: string;
  payload: string;
};

/**
 * 附加行为包发送端（可复制到副包；本文件不依赖主包 Logger）。
 *
 * 职责：持有 uuid、周期 register 直到 assign、分片发送、可选 unregister。
 */
export class ChannelSender {
  /** 本实例固定 uuid */
  private readonly uuid: string = generateUuid();

  /** 主包分配的短 id；未分配时为 undefined */
  private senderId: string | undefined = undefined;

  /** 发送方侧 groupId 递增计数（格式化为 4 位 hex） */
  private groupSeq = 0;

  private pending: PendingSend[] = [];
  private readyWaiters: Array<() => void> = [];

  private ctrlSubscribed = false;
  private retryTimeoutId: number | undefined = undefined;
  private retryElapsed = 0;
  private retryDelay = REGISTER_RETRY_INITIAL_DELAY;
  private retryStopped = false;
  private unregistered = false;

  /**
   * 创建后在下一 tick 开始监听 assign 并立即 register。
   */
  constructor() {
    system.run(() => {
      if (this.unregistered) {
        return;
      }
      this.subscribeCtrl();
      this.beginRegisterLoop();
    });
  }

  /** 是否已拿到短 id、可发数据 */
  get isReady(): boolean {
    return this.senderId !== undefined && !this.unregistered;
  }

  /** 本实例 uuid（调试用） */
  get id(): string {
    return this.uuid;
  }

  /** 已分配的短 senderId；未分配则为 undefined */
  get assignedSenderId(): string | undefined {
    return this.senderId;
  }

  /**
   * 分到号后执行；若已就绪则同步调用。
   */
  whenReady(callback: () => void): void {
    if (this.isReady) {
      callback();
      return;
    }
    this.readyWaiters.push(callback);
  }

  /**
   * 发送完整字符串；未就绪则入队。
   */
  send(topic: string, payload: string): void {
    if (this.unregistered) {
      console.warn(`[${TAG}] 已 unregister，忽略 send topic=${topic}`);
      return;
    }
    if (!isValidTopic(topic)) {
      console.warn(`[${TAG}] 拒绝非法 topic: ${topic}`);
      return;
    }
    if (this.senderId === undefined) {
      this.pending.push({ topic, payload });
      return;
    }
    this.sendNow(topic, payload);
  }

  /**
   * 向主包注销，释放短 id；之后不可再 send（需新建 Sender）。
   */
  unregister(): void {
    if (this.unregistered) {
      return;
    }
    this.unregistered = true;
    this.clearRetryTimer();
    this.pending = [];
    this.readyWaiters = [];
    try {
      system.sendScriptEvent(CTRL_UNREGISTER, this.uuid);
    } catch (e) {
      console.warn(`[${TAG}] unregister 发送失败: ${String(e)}`);
    }
    this.senderId = undefined;
  }

  private subscribeCtrl(): void {
    if (this.ctrlSubscribed) {
      return;
    }
    this.ctrlSubscribed = true;
    system.afterEvents.scriptEventReceive.subscribe(
      (event) => {
        if (event.id !== CTRL_ASSIGN) {
          return;
        }
        const parsed = decodeAssignMessage(event.message);
        if (parsed === undefined || parsed.uuid !== this.uuid) {
          return;
        }
        this.onAssigned(parsed.senderId);
      },
      { namespaces: [CHANNEL_CTRL_NS] }
    );
  }

  /**
   * 立即 register，再按指数退避重试直至 assign 或累计超时。
   */
  private beginRegisterLoop(): void {
    this.fireRegister();
    this.scheduleNextRetry();
  }

  private fireRegister(): void {
    if (this.unregistered || this.senderId !== undefined) {
      return;
    }
    try {
      system.sendScriptEvent(CTRL_REGISTER, this.uuid);
    } catch (e) {
      console.warn(`[${TAG}] register 发送失败: ${String(e)}`);
    }
  }

  private scheduleNextRetry(): void {
    if (this.unregistered || this.senderId !== undefined || this.retryStopped) {
      return;
    }
    const delay = this.retryDelay;
    this.retryTimeoutId = system.runTimeout(() => {
      this.retryTimeoutId = undefined;
      if (this.unregistered || this.senderId !== undefined) {
        return;
      }
      this.retryElapsed += delay;
      if (this.retryElapsed >= REGISTER_RETRY_MAX_TICKS) {
        this.onRegisterGiveUp();
        return;
      }
      this.fireRegister();
      this.retryDelay = Math.min(this.retryDelay * 2, REGISTER_RETRY_MAX_TICKS);
      this.scheduleNextRetry();
    }, delay);
  }

  private onRegisterGiveUp(): void {
    this.retryStopped = true;
    this.clearRetryTimer();
    const dropped = this.pending.length;
    this.pending = [];
    this.readyWaiters = [];
    console.warn(
      `[${TAG}] 累计等待已达上限仍未收到 assign，停止重试 uuid=${this.uuid} 丢弃 pending=${dropped}`
    );
  }

  private onAssigned(senderId: string): void {
    if (this.unregistered) {
      return;
    }
    if (this.senderId !== undefined) {
      return;
    }
    this.senderId = senderId;
    this.clearRetryTimer();
    console.log(`[${TAG}] 已获得 senderId=${senderId} uuid=${this.uuid}`);

    const waiters = this.readyWaiters.splice(0);
    for (const cb of waiters) {
      try {
        cb();
      } catch (e) {
        console.error(`[${TAG}] whenReady 异常: ${String(e)}`);
      }
    }
    const queue = this.pending.splice(0);
    for (const item of queue) {
      this.sendNow(item.topic, item.payload);
    }
  }

  private clearRetryTimer(): void {
    if (this.retryTimeoutId !== undefined) {
      system.clearRun(this.retryTimeoutId);
      this.retryTimeoutId = undefined;
    }
  }

  /**
   * 已持有短 id 时立即分片发送。
   * 片数较多时用 runJob 跨 tick，避免单 tick 打满。
   */
  private sendNow(topic: string, payload: string): void {
    const senderId = this.senderId;
    if (senderId === undefined) {
      return;
    }
    let chunks: string[];
    try {
      chunks = splitPayload(payload);
    } catch (e) {
      console.error(`[${TAG}] 分片失败: ${String(e)}`);
      return;
    }
    const total = chunks.length;
    const groupId = padHex4(this.groupSeq++);
    const eventId = dataEventId(topic);

    const sendFrame = (index: number): boolean => {
      const message = encodeDataFrame(
        senderId,
        groupId,
        total,
        index,
        chunks[index]
      );
      try {
        system.sendScriptEvent(eventId, message);
        return true;
      } catch (e) {
        console.error(
          `[${TAG}] 发送失败 topic=${topic} group=${groupId} index=${index}: ${String(e)}`
        );
        return false;
      }
    };

    if (total <= 8) {
      for (let i = 0; i < total; i++) {
        if (!sendFrame(i)) {
          return;
        }
      }
      return;
    }

    const self = this;
    system.runJob(
      (function* () {
        for (let i = 0; i < total; i++) {
          if (self.unregistered || self.senderId !== senderId) {
            return;
          }
          if (!sendFrame(i)) {
            return;
          }
          yield;
        }
      })()
    );
  }
}
