
/**
 * 新多方块方案 目标是提高性能和拓展性
 * 但因为当前需求不高 暂时不会集中投入
 */
import { Block, Dimension, BlockPermutation, BlockType, BlockVolume, ListBlockVolume } from "@minecraft/server";
import { Vector } from "./VectorMC";

const TAG = 'MultiBlockStructrueManager';

// [{name:"minecraft:air", data: null}]

/**
 * 方块定义
 *  示例 {name:"minecraft:air", state: undefined}
 */
export interface BlockDefinition {
  name: string;
  state?: BlockState;
}

export interface BlockState {
  [key: string]: boolean|string|number;
}

/**
 * 只包含单个方块的结构定义
 */
export interface StructureDefinition {
  blockInactive: BlockDefinition;
  blockActive: BlockDefinition;
  positions: Array<Vector>;
}

let structureDefinitions: Array<StructureDefinition> = [
  {
    blockInactive: {name:"minecraft:air", state: undefined},
    blockActive: {name:"minecraft:air", state: undefined},
    positions: [
      {x: 0, y: 0, z: 0}
    ]
  }
]

export class MultiBlockStructrueManagerV2 {
  size: Vector;
  background: Array<BlockDefinition>;
  structureDefinitions: Array<StructureDefinition>;
  /**
   * @param size Size of structure which contains this coordinate. Example: [8, 6, 8].
   * @param background An array of blocks as background, set undefined for any blocks. Expample: [{name:"minecraft:air", data: null}]
   * @param blocks An array of block as main structure, including activates and deactivates status.
   *   Expample: [{ location: [2, 0, 0], deactivated:{name:"minecraft:wool", data:[{type:"color", value:"red"}]}, activated:{name: "touhou_little_maid:altar_torii_block"}, data: null}]
   */
  constructor(size: Vector, background: Array<BlockDefinition>, structureDefinitions: Array<StructureDefinition>) {
    this.size = size;
    this.background = background;
    this.structureDefinitions = structureDefinitions;
  }

  // TODO: 旋转
  private matchStructureDefinition(definition: StructureDefinition, active: boolean, startPoint: Vector, dimenion: Dimension) {
    let blockVolume = new ListBlockVolume(definition.positions);
    blockVolume.translate(startPoint)
    let blockDefinition = active ? definition.blockActive : definition.blockInactive;

    let matchRes = dimenion.getBlocks(blockVolume, {
      excludePermutations: [BlockPermutation.resolve(blockDefinition.name, blockDefinition.state)]
    });
    if (matchRes.getCapacity() === 0) {
      // 没有其它方块在目标点位 结构完整
    } else {
      // 有其它方块在目标点位 不完整 返回点位
    }
  }

}

