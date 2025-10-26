import { Dimension, Entity } from "@minecraft/server";
import { Vector } from "../../../src/libs/VectorMC";
import { DanmakuActor } from "./DanmakuActor";

export class EntityDanmakuActor extends DanmakuActor {
  public entity: Entity;
  public isHead: boolean;
  private lastLocation: [Dimension, Vector];
  private isLocationLocked: boolean = false;
  
  constructor(entity: Entity, isHead: boolean = false) {
    super();
    this.isHead = isHead;
    this.entity = entity;
    this.lastLocation = [
      this.entity.dimension, 
      this.getPosition()
    ];
  }

  /**
   * 设置是否取头部坐标，不取头部则取脚下坐标
   */
  public setHead(isHead: boolean) {
    this.isHead = isHead;
    return this;
  }

  /**
   * 锁定发射位置
   */
  public lockLocation(dimension: Dimension, location: Vector): this {
    this.lastLocation = [dimension, location];
    this.isLocationLocked = true;
    return this;
  }
  /**
   * 解锁发射位置
   */
  public unlockLocation(): this {
    this.isLocationLocked = false;
    return this;
  }

  public getLocation(): [Dimension, Vector] {
    try {
      if (this.isLocationLocked) {
        return this.lastLocation;
      }
      if (this.entity) {
        this.lastLocation = [
          this.entity.dimension, 
          this.getPosition()
        ];
      }
      return this.lastLocation;
    } catch {
      return this.lastLocation;
    }
  }

  private getPosition(): Vector {
    let res: Vector;
    if (this.isHead) {
      res = this.entity.getHeadLocation();
    } else {
      res = this.entity.location;
    }
    return this.applyOffset(res);
  }
}