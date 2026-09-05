/**
 * 验证 Gecko 标量关键帧简写展开为基岩 vec3（含对象 pre/post）。
 */
import {
  data as dataScalarVec3Expand,
  expandScalarVec3Bones,
  expandScalarVec3Channel,
} from '../src/convertor/animation/processor/APScalarVec3Expand';
import type {AnimationDefinition180} from '../src/convertor/animation/types/AnimationSchema180';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    throw new Error(msg);
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function main() {
  {
    const ch: Record<string, unknown> = {
      '0.0': 0,
      '1.0': {post: 0, lerp_mode: 'catmullrom'},
      '2.0': {pre: 1, post: 1, lerp_mode: 'catmullrom'},
      '3.0': [1, 2, 3],
    };
    expandScalarVec3Channel(ch as any);
    assert(deepEqual(ch['0.0'], [0, 0, 0]), 'number keyframe expands');
    assert(deepEqual((ch['1.0'] as any).post, [0, 0, 0]), 'object post scalar expands');
    assert((ch['1.0'] as any).lerp_mode === 'catmullrom', 'lerp_mode kept');
    assert(deepEqual((ch['2.0'] as any).pre, [1, 1, 1]), 'object pre scalar expands');
    assert(deepEqual((ch['2.0'] as any).post, [1, 1, 1]), 'object post scalar expands');
    assert(deepEqual(ch['3.0'], [1, 2, 3]), 'vec3 kept');
  }

  {
    const anim: AnimationDefinition180 = {
      bones: {Root: {scale: 1}},
      extractedEyeAnimation: {
        bones: {
          LeftEyelid: {
            scale: {'0.0': {post: 1, pre: 1} as any},
          },
        },
      },
    };
    await dataScalarVec3Expand.func({animation: anim, scale: 1});
    assert(anim.bones!.Root.scale === 1, 'constant unchanged');
    const eye = anim.extractedEyeAnimation!.bones!.LeftEyelid.scale as Record<string, any>;
    assert(deepEqual(eye['0.0'].pre, [1, 1, 1]), 'extracted pre expands');
    assert(deepEqual(eye['0.0'].post, [1, 1, 1]), 'extracted post expands');
  }

  {
    const anim: AnimationDefinition180 = {
      bones: {
        Arm: {rotation: {'0.0': {post: 0} as any}},
      },
    };
    expandScalarVec3Bones(anim);
    const rot = anim.bones!.Arm.rotation as Record<string, any>;
    assert(deepEqual(rot['0.0'].post, [0, 0, 0]), 'bones post expands');
  }

  console.log('OK APScalarVec3Expand unit');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
