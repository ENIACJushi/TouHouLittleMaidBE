/**
 * 从一个落脚点列出可逆步。
 * 使用场景：建区块连边、用到落脚点时重读邻居。出发找路只沿这里写下的步走。
 *
 * 可逆步：正向和斜向平走；跳上 1 与落下 1 成对（低侧头顶能跳回）；跨沟只走正方向，两端互相是对方该方向的最近一跳，高差至多 1。
 */
import { GAP_MAX } from "../constants";
import { expandEdges } from "../edges";
import { StandableCache } from "../StandableCache";
import { StandNode } from "../types";

/** 可逆步种类。落下只保留 1 格，所以不写普通 Fall。 */
export type ReversibleKind = "Walk" | "Jump1" | "Fall1" | "SprintGap";

/** 落脚点上记下的一条可逆邻居。 */
export type ReversibleStep = {
  x: number;
  y: number;
  z: number;
  kind: ReversibleKind;
};

/**
 * 低侧头顶多一格净空，才能从低处跳回高处。
 * 使用场景：落下 1 要和跳上 1 成对时，检查低的那一侧。
 */
function lowSideCanJumpBack(cache: StandableCache, low: StandNode): boolean {
  const above = cache.getFlags(low.x, low.y + 3, low.z);
  return above.passable && !above.hazard;
}

/**
 * 对岸沿反方向的最近跨沟是不是回到 from。
 * 使用场景：写入跨沟之前的反向验证。对不上就两边都不留。
 */
function gapReturns(
  cache: StandableCache,
  from: StandNode,
  to: StandNode
): boolean {
  const back = expandEdges(cache, to, { maxFall: 1, includeGap: true });
  for (const edge of back) {
    if (edge.kind !== "SprintGap") {
      continue;
    }
    if (edge.to.x === from.x && edge.to.y === from.y && edge.to.z === from.z) {
      return true;
    }
  }
  return false;
}

/**
 * 列出 from 出发的可逆邻居（世界几何，不看落脚点表里有没有对方）。
 * 使用场景：StandField 再丢掉「对方区块还没建出来」的那几条。
 */
export function reversibleSteps(
  cache: StandableCache,
  from: StandNode
): ReversibleStep[] {
  const edges = expandEdges(cache, from, { maxFall: 1, includeGap: true });
  const out: ReversibleStep[] = [];
  for (const edge of edges) {
    if (edge.kind === "Walk") {
      out.push({ x: edge.to.x, y: edge.to.y, z: edge.to.z, kind: "Walk" });
      continue;
    }
    if (edge.kind === "Jump1") {
      out.push({ x: edge.to.x, y: edge.to.y, z: edge.to.z, kind: "Jump1" });
      continue;
    }
    if (edge.kind === "Fall" && from.y - edge.to.y === 1) {
      if (!lowSideCanJumpBack(cache, edge.to)) {
        continue;
      }
      out.push({ x: edge.to.x, y: edge.to.y, z: edge.to.z, kind: "Fall1" });
      continue;
    }
    if (edge.kind === "SprintGap") {
      const dy = Math.abs(from.y - edge.to.y);
      if (dy > 1) {
        continue;
      }
      if (!gapReturns(cache, from, edge.to)) {
        continue;
      }
      out.push({
        x: edge.to.x,
        y: edge.to.y,
        z: edge.to.z,
        kind: "SprintGap",
      });
    }
  }
  return out;
}

/**
 * 可逆步最远水平距离（跨沟）。
 * 使用场景：重读时只看同一行、同一列、不超过这个距离的邻居。
 */
export const REVERSIBLE_REACH = GAP_MAX;
