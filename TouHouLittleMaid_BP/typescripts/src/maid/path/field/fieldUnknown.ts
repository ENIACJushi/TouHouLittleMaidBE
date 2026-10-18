/**
 * 找路结果「不知道」的短记。
 * 使用场景：区块未就绪或这一拍出发找路预算用尽。只记这名女仆，不记成走不到，不改场。
 * 时长和日程一步相同（约 3 秒），短于走路失败的 30 秒。到期后的下一轮可以再试。
 */
import { Entity } from "@minecraft/server";

/** 短记时长（毫秒）。对齐 MaidScheduleEvents「一步约 3 秒」。 */
export const FIELD_UNKNOWN_MS = 3_000;

const until = new Map<string, number>();

/**
 * 给这名女仆记一次未知。重复记只刷新这一次的到期时间。
 * 使用场景：reversiblePathResult 返回 field_unknown。
 */
export function noteFieldUnknown(maid: Entity): void {
  until.set(maid.id, Date.now() + FIELD_UNKNOWN_MS);
}

/**
 * 这名女仆是否还在未知短记里。
 * 使用场景：耕地选点。过期的记会顺手删掉。
 */
export function hasFieldUnknown(maid: Entity): boolean {
  const expiry = until.get(maid.id);
  if (expiry === undefined) {
    return false;
  }
  if (Date.now() > expiry) {
    until.delete(maid.id);
    return false;
  }
  return true;
}
