import { Block, Dimension } from "@minecraft/server";
import { DanmakuActor } from "./DanmakuActor";
import { Vector } from "../../libs/VectorMC";

export class BlockDanmakuActor extends DanmakuActor {
  public block: Block;
  private location: [Dimension, Vector];
  
  constructor(block: Block) {
    super();
    this.block = block;
    this.location = [block.dimension, block.location];
  }

  public getLocation(): [Dimension, Vector] {
    return [this.location[0], this.applyOffset(this.location[1])];
  }
}