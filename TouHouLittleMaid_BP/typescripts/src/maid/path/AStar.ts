/**
 * 有界 A*（Task7 Phase1）。
 * 使用场景：Path.find / canReach；邻居来自 expandEdges（含 SprintGap）。
 */
import { ASTAR_MAX_EXPAND, ASTAR_MAX_MS } from "./constants";
import { EdgeGenOptions, expandEdges } from "./edges";
import { StandableCache } from "./StandableCache";
import { PathEdge, PathResult, StandNode } from "./types";

function nodeKey(n: StandNode): string {
  return `${n.x},${n.y},${n.z}`;
}

/**
 * 启发：曼哈顿水平 + |Δy|（代价下界；Gap 更贵故仍可采纳）。
 * 使用场景：A* f = g + h。
 */
export function heuristic(a: StandNode, b: StandNode): number {
  return Math.abs(a.x - b.x) + Math.abs(a.z - b.z) + Math.abs(a.y - b.y);
}

/** 开放集最小堆条目 */
type HeapItem = { key: string; f: number; g: number };

/**
 * 简易二叉堆（按 f 升序；f 相同按 g 升序）。
 * 使用场景：开放集；规模受 maxExpand 限制。
 */
class MinHeap {
  private readonly data: HeapItem[] = [];

  get size(): number {
    return this.data.length;
  }

  push(item: HeapItem): void {
    this.data.push(item);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): HeapItem | undefined {
    if (this.data.length === 0) {
      return undefined;
    }
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(this.data[i], this.data[p])) {
        break;
      }
      this.swap(i, p);
      i = p;
    }
  }

  private bubbleDown(i: number): void {
    const n = this.data.length;
    while (true) {
      let best = i;
      const l = i * 2 + 1;
      const r = l + 1;
      if (l < n && this.less(this.data[l], this.data[best])) {
        best = l;
      }
      if (r < n && this.less(this.data[r], this.data[best])) {
        best = r;
      }
      if (best === i) {
        break;
      }
      this.swap(i, best);
      i = best;
    }
  }

  private less(a: HeapItem, b: HeapItem): boolean {
    if (a.f !== b.f) {
      return a.f < b.f;
    }
    return a.g < b.g;
  }

  private swap(i: number, j: number): void {
    const t = this.data[i];
    this.data[i] = this.data[j];
    this.data[j] = t;
  }
}

export type AStarOptions = EdgeGenOptions & {
  maxExpand?: number;
  maxMs?: number;
};

/**
 * 在已 warm 的 StandableCache 上跑 A*。
 * @returns PathResult；失败时 ok=false 并带 reason
 */
export function aStar(
  cache: StandableCache,
  start: StandNode,
  goal: StandNode,
  options?: AStarOptions
): PathResult {
  const maxExpand = options?.maxExpand ?? ASTAR_MAX_EXPAND;
  const maxMs = options?.maxMs ?? ASTAR_MAX_MS;
  const t0 = Date.now();

  const startKey = nodeKey(start);
  const goalKey = nodeKey(goal);

  if (startKey === goalKey) {
    return { ok: true, nodes: [start], edges: [] };
  }

  const open = new MinHeap();
  const gScore = new Map<string, number>();
  const cameFrom = new Map<string, { prev: string; edge: PathEdge }>();
  const closed = new Set<string>();
  /** 节点坐标表，避免反复解析 key */
  const nodes = new Map<string, StandNode>();

  nodes.set(startKey, start);
  gScore.set(startKey, 0);
  open.push({ key: startKey, g: 0, f: heuristic(start, goal) });

  let expands = 0;

  while (open.size > 0) {
    if (Date.now() - t0 > maxMs) {
      return { ok: false, nodes: [], edges: [], reason: "timeout" };
    }
    if (expands >= maxExpand) {
      return { ok: false, nodes: [], edges: [], reason: "max_expand" };
    }

    const cur = open.pop()!;
    if (closed.has(cur.key)) {
      continue;
    }
    // 过期堆条目：更好的 g 已存在
    const knownG = gScore.get(cur.key);
    if (knownG === undefined || cur.g > knownG) {
      continue;
    }

    if (cur.key === goalKey) {
      return reconstruct(nodes, cameFrom, startKey, goalKey);
    }

    closed.add(cur.key);
    expands++;

    const from = nodes.get(cur.key)!;
    const neighbors = expandEdges(cache, from, options);
    for (const e of neighbors) {
      const toKey = nodeKey(e.to);
      if (closed.has(toKey)) {
        continue;
      }
      const tentative = cur.g + e.cost;
      const prevG = gScore.get(toKey);
      if (prevG !== undefined && tentative >= prevG) {
        continue;
      }
      nodes.set(toKey, e.to);
      gScore.set(toKey, tentative);
      cameFrom.set(toKey, { prev: cur.key, edge: e });
      open.push({
        key: toKey,
        g: tentative,
        f: tentative + heuristic(e.to, goal),
      });
    }
  }

  return { ok: false, nodes: [], edges: [], reason: "unreachable" };
}

function reconstruct(
  nodes: Map<string, StandNode>,
  cameFrom: Map<string, { prev: string; edge: PathEdge }>,
  startKey: string,
  goalKey: string
): PathResult {
  const edges: PathEdge[] = [];
  let k = goalKey;
  while (k !== startKey) {
    const step = cameFrom.get(k);
    if (!step) {
      return { ok: false, nodes: [], edges: [], reason: "reconstruct_fail" };
    }
    edges.push(step.edge);
    k = step.prev;
  }
  edges.reverse();
  const pathNodes: StandNode[] = [nodes.get(startKey)!];
  for (const e of edges) {
    pathNodes.push(e.to);
  }
  return { ok: true, nodes: pathNodes, edges };
}
