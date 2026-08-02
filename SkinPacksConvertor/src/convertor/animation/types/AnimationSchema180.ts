/**
 * 基岩版动画定义文件
 *  https://learn.microsoft.com/zh-cn/minecraft/creator/reference/content/schemasreference/schemas/minecraftschema_actor_animation_1.8.0?view=minecraft-bedrock-stable
 */

export type Molang = string | number;
export type LerpMode = 'linear' | 'catmullrom';

export interface Vec3KeyframeObject {
  lerp_mode?: LerpMode;
  pre?: [Molang, Molang, Molang];
  post?: [Molang, Molang, Molang];
}

export type Vec3KeyframeValue = [Molang, Molang, Molang] | Vec3KeyframeObject;

export interface BoneRelativeTo {
  /** if set, makes the bone rotation relative to the entity instead of the bone's parent */
  rotation?: 'entity';
}

export type PositionChannel =
  | Molang
  | Molang[]
  | Record<string, Vec3KeyframeValue>;

export type RotationArrayElement =
  | Molang
  | Partial<Record<'x' | 'y' | 'z', Molang>>;

export type RotationChannel =
  | Molang
  | RotationArrayElement[]
  | Record<string, Vec3KeyframeValue>;

export type ScaleChannel =
  | Molang
  | Molang[]
  | Record<string, Vec3KeyframeValue>;

export interface BoneAnimation {
  relative_to?: BoneRelativeTo;
  position?: PositionChannel;
  rotation?: RotationChannel;
  scale?: ScaleChannel;
}

export interface ParticleEffectEntry {
  /** The name of a particle effect that should be played */
  effect: string;
  /** The name of a locator on the actor where the effect should be located */
  locator?: string;
  /** A Molang script that will be run when the particle emitter is initialized */
  pre_effect_script?: Molang;
  /** Set to false to spawn in world without binding to actor */
  bind_to_actor?: boolean;
}

export interface SoundEffectEntry {
  /** Valid sound effect names should be listed in the entity's resource_definition json file. */
  effect: string;
}

export interface AnimationDefinition180 {
  /** true/false or hold_on_last_frame */
  loop?: boolean | 'hold_on_last_frame';
  start_delay?: Molang;
  loop_delay?: Molang;
  anim_time_update?: Molang;
  blend_weight?: Molang;
  /** reset bones in this animation to the default pose before applying this animation */
  override_previous_animation?: boolean;

  bones?: Record<string, BoneAnimation>;

  particle_effects?: Record<string, ParticleEffectEntry | ParticleEffectEntry[]>;
  sound_effects?: Record<string, SoundEffectEntry | SoundEffectEntry[]>;

  timeline?: Record<string, string | string[]>;

  /**
   * 处理过程中由 molang 伪骨骼提取的变量赋值，导出时并入实体 scripts.pre_animation。
   *  不写入最终动画 json。
   */
  extractedScripts?: string[];

  /** override calculated value and set animation length in seconds */
  animation_length?: number;
}

export interface ActorAnimationFile180 {
  format_version: string;
  animations: Record<`animation.${string}`, AnimationDefinition180>;
}
