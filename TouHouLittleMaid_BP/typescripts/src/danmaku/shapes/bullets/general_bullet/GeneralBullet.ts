/**
 * 通用弹种
 */
import { Dimension, Entity } from "@minecraft/server";
import { Vector } from "../../../../libs/VectorMC";
import { BulletShapeBase } from "../BulletShapeBase";
import { GeneralBulletColor } from "./GeneralBulletColor";
import { GeneralBulletType } from "./GeneralBulletType";

export class GeneralBullet extends BulletShapeBase {
  color = GeneralBulletColor.RANDOM; // 颜色，仅通用弹种
  type = GeneralBulletType.RANDOM; // 类型，仅通用弹种

  //// 构建 ////
  public createBulletEntity (world: Dimension, location: Vector): Entity {
    let bullet = super.createBulletEntity(world, location);
    this.applyColor(bullet);
    return bullet;
  }

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
  public setColor (color: number): this {
    this.color = color;
    return this;
  }
  /**
   * 设置随机颜色
   */
  public setRandomColor(): this {
    this.color = GeneralBulletColor.random();
    return this;
  }
  /**
   * 设置弹幕类型
   */
  public setGeneralBulletType (type: number): this {
    this.type = type;
    return this;
  }
  /**
   * 设置随机类型
   */
  setRandomType(): this {
    this.type = GeneralBulletType.random();
    return this;
  }
}