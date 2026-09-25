/**
 * 生成附加行为包 scripts/main.js 源码。
 * 内嵌与主包一致的通道协议精简实现；发完 skin 后 unregister。
 *
 * @param channelUuid 32 位小写 hex
 * @param skinPayload 与 command.txt 相同的 JSON 字符串
 */
export function buildRegisterMainScript(
  channelUuid: string,
  skinPayload: string,
): string {
  const uuidLiteral = JSON.stringify(channelUuid);
  const payloadLiteral = JSON.stringify(skinPayload);

  return `/**
 * TLM 皮肤附加包：自动经跨包通道注册 skin/chair 配置。
 * 由 SkinPacksConvertor 生成，请勿手改协议常量。
 */
import { system } from "@minecraft/server";

const CHANNEL_UUID = ${uuidLiteral};
const SKIN_PAYLOAD = ${payloadLiteral};

const CTRL_NS = "thlmc";
const DATA_NS = "thlmd";
const CTRL_REGISTER = CTRL_NS + ":register";
const CTRL_ASSIGN = CTRL_NS + ":assign";
const CTRL_UNREGISTER = CTRL_NS + ":unregister";
const TOPIC = "skin";

const SENDER_ID_LEN = 4;
const GROUP_ID_LEN = 4;
const CHUNK_DIGITS = 4;
const FRAME_HEADER_LEN = SENDER_ID_LEN + GROUP_ID_LEN + CHUNK_DIGITS + CHUNK_DIGITS;
const MAX_FRAME = 2000;
const MAX_CHUNK = MAX_FRAME - FRAME_HEADER_LEN;
const RETRY_INITIAL = 20;
const RETRY_MAX = 6000;

function padDecimal(value, digits) {
  let s = String(value);
  while (s.length < digits) s = "0" + s;
  return s;
}

function padHex4(value) {
  let n = ((value % 65536) + 65536) % 65536;
  let s = n.toString(16);
  while (s.length < 4) s = "0" + s;
  return s;
}

function splitPayload(payload) {
  if (payload.length === 0) return [""];
  const chunks = [];
  for (let i = 0; i < payload.length; i += MAX_CHUNK) {
    chunks.push(payload.slice(i, i + MAX_CHUNK));
  }
  return chunks;
}

function encodeFrame(senderId, groupId, total, index, chunk) {
  return senderId + groupId + padDecimal(total, CHUNK_DIGITS) + padDecimal(index, CHUNK_DIGITS) + chunk;
}

function decodeAssign(message) {
  if (message.length !== SENDER_ID_LEN + 32) return undefined;
  const senderId = message.slice(0, SENDER_ID_LEN);
  const uuid = message.slice(SENDER_ID_LEN);
  if (!/^[0-9]{4}$/.test(senderId) || uuid !== CHANNEL_UUID) return undefined;
  return senderId;
}

let senderId = undefined;
let groupSeq = 0;
let retryTimeoutId = undefined;
let retryElapsed = 0;
let retryDelay = RETRY_INITIAL;
let stopped = false;
let done = false;

function clearRetry() {
  if (retryTimeoutId !== undefined) {
    system.clearRun(retryTimeoutId);
    retryTimeoutId = undefined;
  }
}

function fireRegister() {
  if (stopped || done || senderId !== undefined) return;
  try {
    system.sendScriptEvent(CTRL_REGISTER, CHANNEL_UUID);
  } catch (e) {
    console.warn("[TLM SkinAddon] register failed: " + e);
  }
}

function onGiveUp() {
  stopped = true;
  clearRetry();
  console.warn("[TLM SkinAddon] register timeout, channelUuid=" + CHANNEL_UUID);
}

function scheduleRetry() {
  if (stopped || done || senderId !== undefined) return;
  const delay = retryDelay;
  retryTimeoutId = system.runTimeout(() => {
    retryTimeoutId = undefined;
    if (stopped || done || senderId !== undefined) return;
    retryElapsed += delay;
    if (retryElapsed >= RETRY_MAX) {
      onGiveUp();
      return;
    }
    fireRegister();
    retryDelay = Math.min(retryDelay * 2, RETRY_MAX);
    scheduleRetry();
  }, delay);
}

function sendSkin(assignedSenderId) {
  const chunks = splitPayload(SKIN_PAYLOAD);
  const total = chunks.length;
  const groupId = padHex4(groupSeq++);
  const eventId = DATA_NS + ":" + TOPIC;
  for (let i = 0; i < total; i++) {
    try {
      system.sendScriptEvent(eventId, encodeFrame(assignedSenderId, groupId, total, i, chunks[i]));
    } catch (e) {
      console.warn("[TLM SkinAddon] send frame failed i=" + i + ": " + e);
      return;
    }
  }
  try {
    system.sendScriptEvent(CTRL_UNREGISTER, CHANNEL_UUID);
  } catch (e) {
    console.warn("[TLM SkinAddon] unregister failed: " + e);
  }
  done = true;
  console.warn("[TLM SkinAddon] skin registered, frames=" + total);
}

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== CTRL_ASSIGN || done) return;
  const assigned = decodeAssign(event.message);
  if (assigned === undefined) return;
  senderId = assigned;
  clearRetry();
  sendSkin(assigned);
}, { namespaces: [CTRL_NS] });

system.run(() => {
  fireRegister();
  scheduleRetry();
});
`;
}
