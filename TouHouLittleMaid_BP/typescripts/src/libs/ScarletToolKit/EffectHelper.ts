import { Entity } from "@minecraft/server";

/**
 * 药水效果计算工具
 */
export namespace EffectHelper {
  /**
   * 获取实体附加药水效果后的伤害
   * @param entity 实体
   * @param baseDamage 基础伤害
   */
  export function getDamageByEntity(entity: Entity, baseDamage: number) {
    let res = baseDamage;
    // 应用力量效果
    let strength = entity.getEffect('strength')?.amplifier;
    if (strength) {
      res = getStrengthDamage(strength, res);
    }
    // 应用虚弱效果
    let weakness = entity.getEffect('weakness')?.amplifier;
    if (weakness) {
      res = getWeaknessDamage(weakness, res);
    }
    return res;
  }

  /**
   * 为原始伤害施加力量效果
   * 注：和虚弱同时存在时，先计算力量
   *  受影响生物的受力量效果影响后的近战攻击伤害按以下递归公式计算 (x 表示力量效果的等级)
   *  damage(x) = 1.3*damage(x-1)+1
   * @param level 效果等级
   * @param baseDamage 基础伤害
   */
  export function getStrengthDamage(level: number, baseDamage: number): number {
    let res = baseDamage;
    for (let i = 0; i < level; i++) {
      res = 1.3 * res + 1;
    }
    return res;
  }

  /**
   * 为原始伤害施加虚弱效果
   * 注：和力量同时存在时，先计算力量
   * @param level 效果等级
   * @param baseDamage 基础伤害
   */
  export function getWeaknessDamage(level: number, baseDamage: number): number {
    let temp = 0.8**level;
    return baseDamage * temp + (temp - 1) / 0.4;
  }
}