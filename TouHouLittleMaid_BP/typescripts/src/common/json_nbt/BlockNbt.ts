
import {
  Block,
  BlockPermutation,
} from "@minecraft/server";


export namespace BlockJNbt {
  export interface BlockJNbt {
    name?: string;
    states?: Record<string, boolean|string|number>;
    tags?: string[]; // tags 只能用于匹配，无法被修改
  }

  /**
   * 将方块编码为 JsonNbt
   */
  export function encodeBlock(block: Block): BlockJNbt {
    return {
      name: block.typeId,
      states: block.permutation.getAllStates(),
      tags: block.permutation.getTags(),
    };
  }

  /**
   * 将 JsonNbt 解码为方块
   */
  export function decodeBlockJNbt(jNbt: BlockJNbt): BlockPermutation|undefined {
    if (!jNbt.name) {
      return undefined;
    }
    return BlockPermutation.resolve(jNbt.name, jNbt.states);
  }

  /**
   * 匹配方块与 JNbt
   */
  export function match(jNbt: BlockJNbt, block: Block): boolean {
    if (jNbt.name && jNbt.name !== block.typeId) {
      return false;
    }
    if (jNbt.states) {
      for (let state in jNbt.states) {
        // @ts-ignore
        let blockState = block.permutation.getState(state);
        if (!blockState || blockState !== jNbt.states[state]) {
          return false;
        }
      }
    }
    if (jNbt.tags) {
      for (let tag of jNbt.tags) {
        if (!block.permutation.hasTag(tag)) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * 寻找指定范围内符合JNbt的方块
   */
  export function findBlocks() {

  }
}