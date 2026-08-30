/**
 * 验证 catmullrom 烘焙：去掉 lerp_mode，且不再与 Molang 混在同一预计算通道里。
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

// 数值 catmullrom → 线性数字关键帧
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
  assert(countCatmull(anim) === 3, 'setup numeric catmull');
  bakeCatmullRomBones(anim);
  assert(countCatmull(anim) === 0, 'numeric catmull should be baked away');
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
