/**
 * Head 注视：补偿式剥离；驱动式保留；供关闭 look_at_target。
 */
import {
  animationHasCustomHeadLookDrive,
  stripCompensationHeadLook,
} from '../src/convertor/animation/processor/APHeadLookDedup';
import type {AnimationDefinition180} from '../src/convertor/animation/types/AnimationSchema180';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    throw new Error(msg);
  }
}

// 小恶魔式补偿：含 head_y_rotation → 剥掉
{
  const anim: AnimationDefinition180 = {
    bones: {
      Head: {
        rotation: [
          '-math.clamp((-query.target_x_rotation), -30, 30)-(-query.head_y_rotation(0))',
          0,
          0,
        ],
      },
      BackHair: {rotation: ['math.sin(query.anim_time*90)', 0, 0]},
    },
  };
  stripCompensationHeadLook(anim);
  assert(anim.bones!.Head.rotation === undefined, 'compensation Head stripped');
  assert(!animationHasCustomHeadLookDrive(anim), 'no custom drive after strip');
  assert(Array.isArray(anim.bones!.BackHair.rotation), 'non-head kept');
}

// 睡姿：基准角 + target_* → 保留，并视为自定义驱动
{
  const anim: AnimationDefinition180 = {
    bones: {
      Head: {
        rotation: [
          '-91.9+(-query.target_x_rotation)',
          '12+math.clamp(query.target_y_rotation,-80,80)',
          0,
        ],
      },
    },
  };
  stripCompensationHeadLook(anim);
  assert(Array.isArray(anim.bones!.Head.rotation), 'sleep Head kept');
  assert(animationHasCustomHeadLookDrive(anim), 'sleep is custom drive');
}

// 1/4 注视 → 保留
{
  const anim: AnimationDefinition180 = {
    bones: {
      Head: {
        rotation: [
          '(-query.target_x_rotation)/4',
          '(math.clamp(query.target_y_rotation,-80,80))/4',
          0,
        ],
      },
    },
  };
  stripCompensationHeadLook(anim);
  assert(Array.isArray(anim.bones!.Head.rotation), '1/4 look kept');
  assert(animationHasCustomHeadLookDrive(anim), '1/4 is custom drive');
}

// 静态坐下低头 → 不动、非驱动
{
  const anim: AnimationDefinition180 = {
    bones: {Head: {rotation: [-15, 0, 0]}},
  };
  stripCompensationHeadLook(anim);
  assert(Array.isArray(anim.bones!.Head.rotation), 'static kept');
  assert(!animationHasCustomHeadLookDrive(anim), 'static not custom drive');
}

// 枪械非 Head → 不动
{
  const anim: AnimationDefinition180 = {
    bones: {
      Gun: {
        rotation: ['(query.head_y_rotation(0)>0)?-query.head_y_rotation(0)/2:0', 0, 0],
      },
    },
  };
  stripCompensationHeadLook(anim);
  assert(Array.isArray(anim.bones!.Gun.rotation), 'Gun kept');
}

console.log('OK head look dedup (compensation vs drive)');
