import { Dimension } from "@minecraft/server";
import { Vector, VectorMC } from "../../libs/VectorMC";

export abstract class DanmakuActor {
  private offset?: Vector;

  public abstract getLocation(): [Dimension, Vector];
  
  public setOffset(offset: Vector): this {
    this.offset = offset;
    return this;
  }

  public applyOffset(position: Vector): Vector {
    if (this.offset) {
      return VectorMC.add(position, this.offset);
    }
    return position;
  }
}