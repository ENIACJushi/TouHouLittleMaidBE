
  /* -------------------------------------------- *\
   *  Name        :  MultiBlockStructrueManager   *
   *  Description :  A class that helps organize  *
   *                 multi-block structures.      *
   *  Author      :  ENIACJushi                   *
   *  Version     :  1.0                          *
   *  Date        :  2023.02.15                   *
  \* -------------------------------------------- */

import { Block, Dimension, MinecraftBlockTypes } from "mojang-minecraft"
import { BlockLocation } from "mojang-minecraft";
import { world } from "mojang-minecraft";

function logger(str){
    world.getDimension("overworld").runCommand(`tellraw @a { "rawtext": [ { "text": "${str}" } ] }`);
}
const debug = false;
function logger_debug(str){
    if(!debug) return;
    world.getDimension("overworld").runCommand(`tellraw @a { "rawtext": [ { "text": "${str}" } ] }`);
}

export class MultiBlockStructrueManager {
    /**
     * @param {Int[3]} size Size of structure which contains this coordinate. Example: [8, 6, 8].
     * @param {Array} background An array of blocks as background. Expample: [{name:"minecraft:air", data: null}]
     * @param {Array} blocks An array of block as main structure, including activates and deactivates status.
     *   Expample: [{ location: [2, 0, 0], deactivated:{name:"minecraft:wool", data:[{type:"color", value:"red"}]}, activated:{name: "touhou_little_maid:altar_torii_block"}, data: null}]
     */
    constructor(size, background, blocks) {
        this.size = size;
        this.background = background;
        this.blocks = blocks;
    }
    /**
      * @param {Dimension} dimension An MC dimension object.
      * @param {Int[3]} location An array like: [0,0,0].
      * @param {Int[]} rotates Allows rotate structure by y axis. Each rotation is 90 degrees clockwise. You need to take a value between 0 and 3.
      */
    activate(dimension, baseLocation, rotates = [0, 1, 2, 3]){
        let rotate = this.isStructrueUnbroken(dimension, baseLocation, rotates, "deactivated");
        if(rotate == -1) return -1;
        // Activate structure, as structure pending activate is always unbroken, there is no need to check if the previous block matches the deactivated structure block.
        for(let structureBlock of this.blocks){
            // Calculate world coordinate
            let location = this.rotateCoordinate(structureBlock.location, rotate);
            // Create the permutation
            let blockPermutation;
            if(structureBlock["activated"] == null){
                blockPermutation = MinecraftBlockTypes.air.createDefaultBlockPermutation();
            }
            else{
                blockPermutation = MinecraftBlockTypes.get(structureBlock["activated"].name).createDefaultBlockPermutation();
                if(structureBlock["activated"].data != null){
                    for(let data of structureBlock["activated"].data){
                        if(data.value === "r"){
                            blockPermutation.getProperty(data.type).value = rotate + 1;
                        }
                        else{
                            blockPermutation.getProperty(data.type).value = data.value;
                        }
                        
                    }
                }
            }
            // Fetch the block
            const block = dimension.getBlock(new BlockLocation(baseLocation[0] + location[0], baseLocation[1] + location[1], baseLocation[2] + location[2]));
            // Set the permutation
            block.setPermutation(blockPermutation);
            
        }
        return rotate;
    }
    /**
      * @param {Dimension} dimension An MC dimension object.
      * @param {Int[3]} location An array like: [0,0,0].
      * @param {Int[]} rotates Allows rotate structure by y axis. Each rotation is 90 degrees clockwise. You need to take a value between 0 and 3.
      */
    deactivate(dimension, baseLocation, rotate){
        // Check the structure if it is unbroken.
        let checkResult = this.isStructrueUnbroken(dimension, baseLocation, [rotate], "activated", false);
        // Structure is unbroken, do not deactivate.
        if(checkResult != -1) return false;
        // Deactivate structure, as structure pending deactivate is always broken, we need to find the missing block(s).
        for(let structureBlock of this.blocks){
            // Calculate world coordinate
            let location = this.rotateCoordinate(structureBlock.location, rotate);
            
            // Fetch the block
            const block = dimension.getBlock(new BlockLocation(baseLocation[0] + location[0], baseLocation[1] + location[1], baseLocation[2] + location[2]));
            
            // Check if the previous block is destroyed, if not, do not set new block.
            if(structureBlock["activated"] != null && !this.isBlockInStructrue(block, structureBlock["activated"])) continue;
            // Set new block
            // Create the permutation
            let blockPermutation;
            if(structureBlock["deactivated"] == null){
                blockPermutation = MinecraftBlockTypes.air.createDefaultBlockPermutation();
            }
            else{
                blockPermutation = MinecraftBlockTypes.get(structureBlock["deactivated"].name).createDefaultBlockPermutation();
                if(structureBlock["deactivated"].data != null){
                    for(let data of structureBlock["deactivated"].data){
                        blockPermutation.getProperty(data.type).value = data.value;
                    }
                }
            }
            // Set the permutation
            block.setPermutation(blockPermutation);
        }
        return true;
    }


    ///// Structure Operation /////
    /**
      * This function detects whether the structure in the world satisfies a given rotation.
      * @param {Dimension} dimension: An MC dimension object.
      * @param {Int[3]} location: An array like: [0,0,0].
      * @param {Int[]} rotates: Allows rotate structure by y axis. Each rotation is 90 degrees clockwise. You need to take a value between 0 and 3.
      * @param {String} mode "activated" or "deactivated". Corresponds to the properties in the array this.blocks.
      * @param {Boolean} background Check background block.
      * @return  -1: every given rotation is broken; 0/1/2/3: This rotation is unbroken.
      */
    isStructrueUnbroken(dimension, baseLocation, rotates = [0, 1, 2, 3], mode ="deactivated", background = true){
        for(let rotate of rotates){
            // Rotation must be valid.
            if(rotate < 0 || rotate > 3) continue;
            // If check background, use a scan matrix to increase speed.
            if(background){
                // Create scan matrix [x][y][z].
                let scanMatrix = [];
                for(let x = 0; x < this.size[0]; x++){
                    scanMatrix[x] = [];
                    for(let y = 0; y < this.size[1]; y++){
                        scanMatrix[x][y] = [];
                        for(let z = 0; z < this.size[2]; z++){
                            scanMatrix[x][y][z]= -1;
                        }
                    }
                }
                // Put rotated structure into matrix.
                for(let i = 0; i < this.blocks.length; i++){
                    let location = this.rotateCoordinate(this.blocks[i].location, rotate);
                    scanMatrix[location[0]][location[1]][location[2]] = i;
                }
                // Check the structure in the world if it is broken.
                let broken = false;
                for(let x = 0; x < scanMatrix.length; x++){
                    for(let y = 0 ; y < scanMatrix[x].length; y++){
                        for (let z = 0; z < scanMatrix[x][y].length; z++){
                            // dimension.runCommand(`say ${baseLocation[0] + x},${baseLocation[1] + y},${baseLocation[2] + z}`);
                            const block = dimension.getBlock(new BlockLocation(baseLocation[0] + x, baseLocation[1] + y, baseLocation[2] + z));
                            // Background block
                            if(scanMatrix[x][y][z] === -1){
                                if(!this.isBackground(block)) {
                                    broken = true;
                                    break;
                                }
                            }
                            // Structure block
                            else{
                                if(!this.isBlockInStructrue(block, this.blocks[scanMatrix[x][y][z]][mode])) {
                                    broken = true;
                                    break;
                                }
                            }
                        }
                        if(broken == true) break;
                    }
                    if(broken == true) break;
                }
                // If not broken, end check and return this rotation.
                if(!broken) return rotate;
            }
            // If not check background, just scan structure blocks one by one.
            else{
                // Check the structure in the world if it is broken.
                let broken = false;
                for(let structureBlock of this.blocks){
                    // Calculate world coordinate
                    let location = this.getPointByBaseLocation(structureBlock.location, baseLocation, rotate);
                    if(structureBlock[mode] != null 
                        && !this.isBlockInStructrue(dimension.getBlock(new BlockLocation(location[0], location[1], location[2])), structureBlock[mode])){
                        broken = true;
                        break;
                    }
                }
                // If not broken, end check and return this rotation.
                if(!broken) return rotate;
            }
        }
        return -1;
    }
    isBackground(block){
        if(this.background != null && this.background != []){
            for(let backgroundBlock of this.background){
                if(block.id == backgroundBlock.name){
                    let dataMatched = true;
                    if(backgroundBlock.data != null){
                        if(backgroundBlock.data != null){
                            for(let data of backgroundBlock.data){
                                if(block.permutation.getProperty(data.type).value != data.value){
                                    dataMatched = false;
                                    break;
                                }
                            }
                        }
                    }
                    if(dataMatched) return true;
                }
            }
            return false;
        }
        return true;
    }
    /**
      * @param {Block} block A MC block object.
      * @param {Int} iter Sequence in blocks array.
      * @param {String} mode "activated" or "deactivated".
      */
    isBlockInStructrue(block, structureBlock){
        // logger(`${block.id},${this.blocks[iter][mode].name}`);
        if(block.id == structureBlock.name){
            let dataMatched = true;
            if(structureBlock.data != null){
                for(let data of structureBlock.data){
                    if(block.permutation.getProperty(data.type).value != data.value){
                        logger_debug(`Broken permutation: ${data.type} - expected ${data.value}, but ${block.permutation.getProperty(data.type).value}`);
                        return false;
                    }
                }
            }
            if(dataMatched) return true;
        }
        else{
            logger_debug(`Broken id: expected ${structureBlock.name}, but ${block.id}`);
            return false;
        }
        
    }


    ///// Location Operation /////
    /**
      * @param {Int[3]} input Coordinate pending to rotate. Example: [0, 0, 0].
      * @param {Int} rotate Number of structural rotations by y axis. Each rotation is 90 degrees clockwise, you need to take a value between 0 and 3.
      */
    rotateCoordinate(input, rotate = 0){
        switch(rotate){
            case 0: return input;
            case 1: return [this.size[0] - 1 - input[2], input[1],                    input[0]];
            case 2: return [this.size[0] - 1 - input[0], input[1], this.size[2] - 1 - input[2]];
            case 3: return [                   input[2], input[1], this.size[2] - 1 - input[0]];
            default: return input;
        }
    }
    getBaseLocationByPoint(relativeCoordinate, point, rotate = 0){
        switch(rotate){
            default: return [point[0]                    - relativeCoordinate[0], point[1] - relativeCoordinate[1], point[2]                    - relativeCoordinate[2]];
            case 1:  return [point[0] - this.size[0] + 1 + relativeCoordinate[2], point[1] - relativeCoordinate[1], point[2]                    - relativeCoordinate[0]];
            case 2:  return [point[0] - this.size[0] + 1 + relativeCoordinate[0], point[1] - relativeCoordinate[1], point[2] - this.size[2] + 1 + relativeCoordinate[2]];
            case 3:  return [point[0]                    - relativeCoordinate[2], point[1] - relativeCoordinate[1], point[2] - this.size[2] + 1 + relativeCoordinate[0]];
        }
    }
    getPointByBaseLocation(relativeCoordinate, baseLocation, rotate = 0){
        switch(rotate){
            default: return [baseLocation[0]                    + relativeCoordinate[0], baseLocation[1] + relativeCoordinate[1], baseLocation[2]                    + relativeCoordinate[2]];
            case 1:  return [baseLocation[0] + this.size[0] - 1 - relativeCoordinate[2], baseLocation[1] + relativeCoordinate[1], baseLocation[2]                    + relativeCoordinate[0]];
            case 2:  return [baseLocation[0] + this.size[0] - 1 - relativeCoordinate[0], baseLocation[1] + relativeCoordinate[1], baseLocation[2] + this.size[2] - 1 - relativeCoordinate[2]];
            case 3:  return [baseLocation[0]                    + relativeCoordinate[2], baseLocation[1] + relativeCoordinate[1], baseLocation[2] + this.size[2] - 1 - relativeCoordinate[0]];
        }
    }
}

