import {getDynamicMolangVariableDefaults} from '../../molang/v/VariableResolvers';

/**
 * 将「默认非 0」的 YSM 配饰变量写入 `scripts.pre_animation` 前端。
 *
 * 背景：部分变量只出现在骨骼 scale 通道，未出现在 extractedScripts 左值，
 * initialize  alone 不足以保证每帧可读。几何体永久隐藏后本步多为兜底冗余。
 *
 * 仅处理 `ysm_roaming_*`，不影响弹簧等其它 keep 变量。
 */
export function appendForcedYsmAccessoryDefaultsToPreAnimation(preAnimation: string[]): void {
  const defaults = getDynamicMolangVariableDefaults();
  const lines: string[] = [];
  for (const [field, value] of [...defaults.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (!field.startsWith('ysm_roaming_')) {
      continue;
    }
    if (value === 0) {
      continue;
    }
    lines.push(`v.${field}=${value};`);
  }
  if (lines.length > 0) {
    // 放在 pre_animation 靠前，确保同帧后续动画读取到隐藏值
    preAnimation.unshift(...lines);
  }
}
