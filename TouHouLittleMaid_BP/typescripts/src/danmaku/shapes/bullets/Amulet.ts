import { Dimension, Entity } from "@minecraft/server";
import { BulletBase } from "./BulletBase";
import { Vector } from "../../../libs/VectorMC";

export class Amulet extends BulletBase {
  getBulletEntityName (): string {
    return 'thlmd:bullet_amulet';
  }
  public createBulletEntity (world: Dimension, location: Vector): Entity {
    let bullet = super.createBulletEntity(world, location);
    this.applyRotation(bullet, new Vector(0,0,0));
    return bullet;
  }
  /**
   * 设置旋转角(用于试验渲染是否正常，暂无实际作用)
   */
  applyRotation(entity: Entity, speed: Vector) {
    entity.setProperty('thlm:r_x', 30);
  }
}