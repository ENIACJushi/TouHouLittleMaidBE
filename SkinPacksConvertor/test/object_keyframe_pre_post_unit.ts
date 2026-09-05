/**
 * 对象关键帧 pre/post 标量简写：ScaleHold / Bake 在未先展开时也应写出合法 vec3。
 */
import {padCatmullRomScaleHold} from '../src/convertor/animation/processor/APCatmullRomScaleHold';
import {bakeCatmullRomBones} from '../src/convertor/animation/processor/APCatmullRomBake';
import type {AnimationDefinition180} from '../src/convertor/animation/types/AnimationSchema180';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    throw new Error(msg);
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ScaleHold：末帧 {post:1} 标量 → 补帧 post 为 [1,1,1]，不得出现 null
{
  const anim: AnimationDefinition180 = {
    animation_length: 4,
    bones: {
      LeftEyelid: {
        scale: {
          '0.0': {post: 1, lerp_mode: 'catmullrom'} as any,
          '0.2917': {post: 1, pre: 1, lerp_mode: 'catmullrom'} as any,
        },
      },
    },
  };
  padCatmullRomScaleHold(anim);
  const hold = (anim.bones!.LeftEyelid.scale as Record<string, any>)['4'];
  assert(hold && hold.lerp_mode === 'catmullrom', 'hold frame added');
  assert(deepEqual(hold.post, [1, 1, 1]), 'scalar post cloned as triplet');
  assert(hold.post.every((x: unknown) => x !== null && x !== undefined), 'no null');
}

// Bake：未先展开时也能吃掉 {post:0} 标量 catmullrom
{
  const anim: AnimationDefinition180 = {
    animation_length: 3,
    bones: {
      LeftArm: {
        rotation: {
          '0.0': {post: 0, lerp_mode: 'catmullrom'} as any,
          '1.5': {post: [0, 0, -1], lerp_mode: 'catmullrom'},
          '3.0': {post: 0, lerp_mode: 'catmullrom'} as any,
        },
      },
    },
  };
  // 纯常量默认不烘焙；本用例验证 bake 路径对标量 post 的防御，需 force
  bakeCatmullRomBones(anim, {force: true});
  const ch = anim.bones!.LeftArm.rotation as Record<string, any>;
  for (const [t, v] of Object.entries(ch)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if ('post' in v) {
        assert(Array.isArray(v.post), `${t}.post must be array after bake path`);
      }
      assert(v.lerp_mode !== 'catmullrom', `${t} catmullrom must be gone`);
    }
  }
  assert(Array.isArray(ch['0.0']) || Array.isArray(ch['0.0']?.post), 'start frame usable');
}

console.log('OK object keyframe pre/post scalar defensive');
