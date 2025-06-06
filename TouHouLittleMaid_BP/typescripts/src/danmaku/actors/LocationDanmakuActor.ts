import { Dimension } from "@minecraft/server";
import { DanmakuActor, } from "./DanmakuActor";
import { Vector } from "../../libs/VectorMC";

export class LocationDanmakuActor extends DanmakuActor {
  public dimension: Dimension;
  public position: Vector;
  
  constructor(dimension: Dimension, position: Vector) {
    super();
    this.dimension = dimension;
    this.position = position;
  }

  public getLocation(): [Dimension, Vector] {
    return [this.dimension, this.applyOffset(this.position)];
  }
}