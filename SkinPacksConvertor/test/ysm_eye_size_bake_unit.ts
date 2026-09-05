/**
 * koishi 类：瞳孔父骨 scale 为 [v.Lyanxs, v.Lyanxs, 1]，
 * 须按表单/timeline 默认 1 烘焙，否则 initialize=0 会把眼珠缩没。
 */
import {
  clearDynamicMolangRegistrations,
  registerMolangVariableDefault,
} from '../src/convertor/molang/v/VariableResolvers';
import {registerYsmAccessoryDefaults} from '../src/convertor/ysm/accessory/YsmAccessoryDefaults';
import {data as dataYsmAccessoryHide} from '../src/convertor/ysm/accessory/APYsmAccessoryHide';
import type {YsmJson} from '../src/convertor/ysm/YsmJson';
import type {AnimationDefinition180} from '../src/convertor/animation/types/AnimationSchema180';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    throw new Error(msg);
  }
}

async function main() {
  clearDynamicMolangRegistrations();

  const manifest = {
    properties: {
      extra_animation_buttons: [
        {
          id: 'eye',
          config_forms: [
            {
              type: 'range',
              title: '左眼大小: ',
              value: 'v.Lyanxs',
              min: 0,
              max: 1.2,
            },
            {
              type: 'range',
              title: '右眼大小: ',
              value: 'v.Ryanxs',
              min: 0,
              max: 1.2,
            },
          ],
        },
      ],
    },
  } as YsmJson;

  registerYsmAccessoryDefaults(manifest, []);

  {
    const anim: AnimationDefinition180 = {
      bones: {
        LeftP: {
          // 模拟 APMolang 之后：字段已是小写 keep 名
          scale: ['v.lyanxs', 'v.lyanxs', 1],
        },
        RightP: {
          scale: ['v.ryanxs', 'v.ryanxs', 1],
        },
      },
    };

    await dataYsmAccessoryHide.func({animation: anim, scale: 1});

    assert(
      JSON.stringify(anim.bones!.LeftP.scale) === JSON.stringify([1, 1, 1]),
      `LeftP should bake to [1,1,1], got ${JSON.stringify(anim.bones!.LeftP.scale)}`,
    );
    assert(
      JSON.stringify(anim.bones!.RightP.scale) === JSON.stringify([1, 1, 1]),
      `RightP should bake to [1,1,1], got ${JSON.stringify(anim.bones!.RightP.scale)}`,
    );
  }

  clearDynamicMolangRegistrations();
  registerMolangVariableDefault('zuixsx', 1);
  {
    const anim: AnimationDefinition180 = {
      bones: {
        Mouth: {scale: 'v.zuixsx'},
      },
    };
    await dataYsmAccessoryHide.func({animation: anim, scale: 1});
    assert(anim.bones!.Mouth.scale === 1, 'plain v.field scale bakes from default');
  }

  console.log('OK eye size scale bake unit');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
