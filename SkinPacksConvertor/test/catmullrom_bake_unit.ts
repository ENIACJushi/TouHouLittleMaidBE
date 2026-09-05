/**
 * 验证 catmullrom 烘焙策略：
 * - 纯常量样条默认保留（idle 摇晃）
 * - force 时烘焙（walk 注入 Molang 前）
 * - 混有 Molang 时去掉 lerp_mode，避免基岩预计算报错
 */
import {bakeCatmullRomBones} from '../src/convertor/animation/processor/APCatmullRomBake';
import type {AnimationDefinition180} from '../src/convertor/animation/types/AnimationSchema180';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    throw new Error(msg);
  }
}

function countCatmull(anim: AnimationDefinition180): number {
  let n = 0;
  for (const bone of Object.values(anim.bones || {})) {
    for (const ch of [bone.position, bone.rotation, bone.scale]) {
      if (!ch || typeof ch !== 'object' || Array.isArray(ch)) continue;
      for (const v of Object.values(ch)) {
        if (v && typeof v === 'object' && !Array.isArray(v) && v.lerp_mode === 'catmullrom') {
          n++;
        }
      }
    }
  }
  return n;
}

// 纯数值 catmullrom → 默认保留（避免 idle 稀疏样条被压成线性平台）
{
  const anim: AnimationDefinition180 = {
    animation_length: 1.52,
    bones: {
      LeftArm: {
        rotation: {
          '0.0': {lerp_mode: 'catmullrom', post: [0, 0, 7.25]},
          '0.76': {lerp_mode: 'catmullrom', post: [0, 0, 8.75]},
          '1.52': {lerp_mode: 'catmullrom', post: [0, 0, 7.25]},
        },
      },
    },
  };
  assert(countCatmull(anim) === 3, 'setup numeric catmull');
  bakeCatmullRomBones(anim);
  assert(countCatmull(anim) === 3, 'numeric catmull should be preserved by default');
  const mid = (anim.bones!.LeftArm.rotation as Record<string, any>)['0.76'];
  assert(mid?.post?.[2] === 8.75, 'original peak value must stay');
}

// force：纯数值也烘焙（walk 路径）
{
  const anim: AnimationDefinition180 = {
    animation_length: 1,
    bones: {
      arm: {
        rotation: {
          '0.0': {lerp_mode: 'catmullrom', post: [0, 0, 0]},
          '0.5': {lerp_mode: 'catmullrom', post: [10, 0, 0]},
          '1.0': {lerp_mode: 'catmullrom', post: [0, 0, 0]},
        },
      },
    },
  };
  bakeCatmullRomBones(anim, {force: true});
  assert(countCatmull(anim) === 0, 'force should bake numeric catmull away');
  const keys = Object.keys(anim.bones!.arm.rotation as object);
  assert(keys.length >= 3, 'should keep/add keyframes');
}

// catmullrom + Molang 同通道 → 去掉 catmullrom，保留 Molang 为线性 vec3
{
  const rain = '(query.is_in_water==0)?0:-19.67';
  const anim: AnimationDefinition180 = {
    animation_length: 2,
    bones: {
      LeftForeArm: {
        rotation: {
          '0.0': {lerp_mode: 'catmullrom', post: [0, 0, 0]},
          '1.0': {lerp_mode: 'catmullrom', post: [rain, rain, rain]},
          '2.0': [0, 0, 0],
        },
      },
    },
  };
  bakeCatmullRomBones(anim);
  assert(countCatmull(anim) === 0, 'molang catmull must strip lerp_mode');
  const ch = anim.bones!.LeftForeArm.rotation as Record<string, unknown>;
  const mid = ch['1.0'];
  assert(Array.isArray(mid), 'molang frame becomes plain vec3');
  assert(mid[0] === rain, 'molang expression preserved');
}

console.log('OK APCatmullRomBake unit');
