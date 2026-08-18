/**
 * YSM `v.ysm_roaming_*` / 归一化后的配饰 scale 表达式简易求值。
 *
 * 供几何体藏骨与动画 scale 烘焙共用，避免两处规则漂移。
 * 无法识别的写法返回 `undefined`（调用方应保持原表达式或跳过）。
 */
export function evalSimpleYsmRoamingExpr(
  expr: string,
  defaults: ReadonlyMap<string, number>,
): number | undefined {
  // v.ysm_roaming_xxx
  let m = /^v\.(ysm_roaming_[a-z0-9_]+)$/i.exec(expr);
  if (m) {
    return defaults.get(m[1].toLowerCase()) ?? 0;
  }

  // 1-v.ysm_roaming_xxx
  m = /^1-v\.(ysm_roaming_[a-z0-9_]+)$/i.exec(expr);
  if (m) {
    return 1 - (defaults.get(m[1].toLowerCase()) ?? 0);
  }

  // 1-(v.ysm_roaming_xxx==N?1:0) 或 1-(v.ysm_roaming_xxx?1:0)
  m = /^1-\(v\.(ysm_roaming_[a-z0-9_]+)(==([0-9.]+))?(\?1:0)?\)$/i.exec(expr);
  if (m) {
    const cur = defaults.get(m[1].toLowerCase()) ?? 0;
    if (m[2]) {
      return 1 - (cur === Number(m[3]) ? 1 : 0);
    }
    return 1 - (cur ? 1 : 0);
  }

  // v.ysm_roaming_xxx==N?1:0
  m = /^v\.(ysm_roaming_[a-z0-9_]+)==([0-9.]+)\?1:0$/i.exec(expr);
  if (m) {
    const cur = defaults.get(m[1].toLowerCase()) ?? 0;
    return cur === Number(m[2]) ? 1 : 0;
  }

  // (v.ysm_roaming_xxx==N)?1:0
  m = /^\(v\.(ysm_roaming_[a-z0-9_]+)==([0-9.]+)\)\?1:0$/i.exec(expr);
  if (m) {
    const cur = defaults.get(m[1].toLowerCase()) ?? 0;
    return cur === Number(m[2]) ? 1 : 0;
  }

  // 0+v.ysm_roaming_xxx==1 之类宽松写法
  m = /^0\+v\.(ysm_roaming_[a-z0-9_]+)==1$/i.exec(expr);
  if (m) {
    const cur = defaults.get(m[1].toLowerCase()) ?? 0;
    return cur === 1 ? 1 : 0;
  }

  return undefined;
}
