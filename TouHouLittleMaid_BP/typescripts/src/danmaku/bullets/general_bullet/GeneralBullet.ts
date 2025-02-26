/**
 * 通用弹种
 */
import { Entity } from "@minecraft/server";
import { Vector } from "../../../libs/VectorMC";
import { BulletBase } from "../BulletBase";
import { GeneralBulletColor } from "./GeneralBulletColor";
import { GeneralBulletType } from "./GeneralBulletType";

export class GeneralBullet extends BulletBase {
  color = GeneralBulletColor.RANDOM; // 颜色，仅通用弹种
  type = GeneralBulletType.RANDOM; // 类型，仅通用弹种

  public shoot(direction: Vector, velocity: number, inaccuracy?: number): Entity | undefined {
    let danmaku = super.shoot(direction, velocity, inaccuracy);
    if (!danmaku) {
      return undefined;
    }
    this.applyColor(danmaku);
    return danmaku;
  }

  public shoot_bedrock(velocity: Vector, inaccuracy: number): Entity | undefined {
    let danmaku = super.shoot(velocity, inaccuracy);
    if (!danmaku) {
      return undefined;
    }
    this.applyColor(danmaku);
    return danmaku;
  }

  //// 工厂函数 ////
  protected getBulletEntityName (): string {
    let type = this.type === GeneralBulletType.RANDOM ? GeneralBulletType.random() : this.type;
    return GeneralBulletType.getEntityName(type);
  }

  protected applyColor (danmaku: Entity) {
    danmaku.triggerEvent(GeneralBulletColor.getTriggerEvent(this.color));
  }

  //// 设置函数 ////
  /**
   * @param color GeneralBulletColor
   */
  public setColor (color: number): GeneralBullet {
    this.color = color;
    return this;
  }
  
  /**
   * @param type GeneralBulletType
   */
  public setGeneralBulletType (type: number): GeneralBullet {
    this.type = type;
    return this;
  }
}