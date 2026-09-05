/**
 * YSM 坐下贴地适配单测
 */
import {
  clearDynamicMolangRegistrations,
  registerMolangVariableDefault,
} from '../src/convertor/molang/v/VariableResolvers';
import {toYsmRoamingKeepField} from '../src/convertor/ysm/roaming/YsmRoamingFields';
import {
  adaptYsmSitAnimation,
  adaptYsmSitClips,
  estimateSitDownwardY,
  sitheightDefaultFromForm,
  isSitheightField,
  YSM_SIT_TARGET_LOWER_Y,
  YSM_SITHEIGHT_DEFAULT,
} from '../src/convertor/ysm/adaptYsmSitAnimation';
import type {AnimationDefinition180} from '../src/convertor/animation/types/AnimationSchema180';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    throw new Error(msg);
  }
}

clearDynamicMolangRegistrations();

// --- sitheight 表单默认 ---
assert(sitheightDefaultFromForm(-5, 5) === -5, 'form min 应为默认');
assert(sitheightDefaultFromForm(undefined, undefined) === YSM_SITHEIGHT_DEFAULT, '无 min 用常量');
assert(isSitheightField('sitheight'), 'leaf sitheight');
assert(isSitheightField('foo', '坐下高度调整'), '标题命中');

// --- 小恶魔式：Root -5 + sitheight 默认 -5 → 再补 Root ---
{
  clearDynamicMolangRegistrations();
  registerMolangVariableDefault(toYsmRoamingKeepField('sitheight'), -5);
  const anim: AnimationDefinition180 = {
    bones: {
      Root: {position: [0, -5, 5]},
      AllBody: {position: [0, 'v.roaming.sitheight', 0]},
    },
  };
  const before = estimateSitDownwardY(anim);
  assert(Math.abs(before - 10) < 0.01, `期望下压约 10，实际 ${before}`);
  assert(adaptYsmSitAnimation(anim), '应发生补足');
  const rootPos = anim.bones!.Root.position as [number, number, number];
  assert(
    rootPos[1] === -(YSM_SIT_TARGET_LOWER_Y - 5),
    `Root 应变为 ${-(YSM_SIT_TARGET_LOWER_Y - 5)}，实际 ${rootPos[1]}`,
  );
  const allBodyPos = anim.bones!.AllBody.position as [number, string, number];
  assert(allBodyPos[1] === 'v.roaming.sitheight', 'AllBody sitheight 表达式应保留');
}

// --- 恋恋式：仅 Root -3.26，无 sitheight ---
{
  clearDynamicMolangRegistrations();
  const anim: AnimationDefinition180 = {
    bones: {
      Root: {position: [0, -3.26, -3.03]},
    },
  };
  assert(adaptYsmSitAnimation(anim), '应补足');
  const rootPos = anim.bones!.Root.position as [number, number, number];
  assert(
    Math.abs(rootPos[1] - -YSM_SIT_TARGET_LOWER_Y) < 0.01,
    `Root Y 应≈${-YSM_SIT_TARGET_LOWER_Y}，实际 ${rootPos[1]}`,
  );
}

// --- 已足够下压：不改 ---
{
  clearDynamicMolangRegistrations();
  const anim: AnimationDefinition180 = {
    bones: {
      Root: {position: [0, -14, 2]},
    },
  };
  assert(!adaptYsmSitAnimation(anim), '已够贴地则不改');
  assert((anim.bones!.Root.position as number[])[1] === -14, 'Root 保持');
}

// --- clips 批量 ---
{
  clearDynamicMolangRegistrations();
  const n = adaptYsmSitClips({
    sit: {bones: {Root: {position: [0, -2, 0]}}},
    idle: {bones: {Root: {position: [0, 0, 0]}}},
    sit2: {bones: {}},
  });
  assert(n === 1, `应只适配 1 条非空 sit，实际 ${n}`);
}

console.log('adaptYsmSitAnimation unit: ok');
