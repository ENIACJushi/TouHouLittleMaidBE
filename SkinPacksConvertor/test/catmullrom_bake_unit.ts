/**
 * 验证 catmullrom 烘焙策略：
 * - 非循环纯常量：保留原生样条
 * - 循环纯常量：环绕烘焙为线性，保留峰值（修接缝卡顿）
 * - force：强制烘焙（walk）
 * - 混有 Molang：去掉 lerp_mode
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

// 非循环纯数值 catmullrom → 默认保留
{
  const anim: AnimationDefinition180 = {
    animation_length: 4,
    loop: false,
    bones: {
      LeftEyelid: {
        position: {
          '0.0': {lerp_mode: 'catmullrom', post: [0, 0, 0]},
          '0.2917': {lerp_mode: 'catmullrom', post: [0, 0, 0]},
        },
      },
    },
  };
  bakeCatmullRomBones(anim);
  assert(countCatmull(anim) === 2, 'non-loop numeric catmull should be preserved');
}

// 循环纯数值（koishi idle）→ 烘焙，峰值保留，无平台塌陷
{
  const anim: AnimationDefinition180 = {
    animation_length: 1.52,
    loop: true,
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
  assert(countCatmull(anim) === 3, 'setup loop numeric catmull');
  bakeCatmullRomBones(anim);
  assert(countCatmull(anim) === 0, 'loop numeric catmull should be baked');
  const ch = anim.bones!.LeftArm.rotation as Record<string, any>;
  assert(Array.isArray(ch['0.76']) && ch['0.76'][2] === 8.75, 'peak value must stay');
  assert(Array.isArray(ch['0.0']) && ch['0.0'][2] === 7.25, 'start value must stay');
  assert(Object.keys(ch).length >= 5, 'should insert in-between samples');
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
  const mid = (anim.bones!.arm.rotation as Record<string, any>)['0.5'];
  assert(Array.isArray(mid) && mid[0] === 10, 'force bake keeps original peak');
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
