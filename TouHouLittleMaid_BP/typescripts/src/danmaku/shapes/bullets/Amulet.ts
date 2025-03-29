import { Dimension, Entity } from "@minecraft/server";
import { BulletBase } from "./BulletBase";
import { Vector, VectorMC } from "../../../libs/VectorMC";
import { logger } from "../../../libs/ScarletToolKit";

const ANGLE_PI = 180 / Math.PI;

export class Amulet extends BulletBase {
  getBulletEntityName (): string {
    return 'thlmd:bullet_amulet';
  }
  public createBulletEntity (world: Dimension, location: Vector): Entity {
    let bullet = super.createBulletEntity(world, location);
    
    return bullet;
  }

  public initVelocity(entity: Entity, velocity: Vector) {
    super.initVelocity(entity, velocity);
    Amulet.setRotationByDirection(entity, VectorMC.normalized(velocity));
  }
  
  public setEntityVelocity(entity: Entity, velocity: Vector) {
    super.setEntityVelocity(entity, velocity);
    Amulet.setRotationByDirection(entity, velocity);
  }

  
  public applyEntityImpulse(entity: Entity, velocity: Vector) {
    entity.applyImpulse(velocity);
    Amulet.setRotationByDirection(entity, velocity);
  }


  /**
   * Z - Y 决定朝向
   * X 决定滚动角
   */
  static setRotationByDirection(entity: Entity, direction: Vector) {
    let input = VectorMC.normalized(direction);
    // 动画坐标系的xz和世界坐标系相反
    // input.x = -1 * input.x
    // input.z = -1 * input.z
    // // let euler = VectorMC.getEulerAngle(input);
    // let y = ANGLE_PI * Math.atan2(input.z, input.x)
    // let z = ANGLE_PI * Math.atan2(input.y, Math.abs(input.x))
    // console.log('y', y.toFixed(3), 'z', z.toFixed(3))

    // math.atan2(y, x)
    // entity.setProperty("thlm:r_x", 0);
    // entity.setProperty("thlm:r_y", y);
    // entity.setProperty("thlm:r_z", z);

    entity.setProperty("thlm:v_x", -input.x);
    entity.setProperty("thlm:v_y", input.y);
    entity.setProperty("thlm:v_z", -input.z);
  }
}