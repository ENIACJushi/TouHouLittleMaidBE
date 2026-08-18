/**
 * YSM / 贴图名 → 可用作 geometry、贴图路径段的安全标识。
 * 规则：仅保留字母数字下划线，小写；空则回退；禁止数字开头。
 */
export function toSafeIdentifier(name: string, fallbackId: number): string {
  let safe = name
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  if (!safe) {
    safe = `ysm_${fallbackId}`;
  }
  if (/^[0-9]/.test(safe)) {
    safe = `a${safe}`;
  }
  return safe.toLowerCase();
}
