
const BadContainerBlocks = [
    "minecraft:frame",
    "minecraft:glow_frame",
    "minecraft:decorated_pot"
]

/**
 * 检查与此方块交互时，是否会将物品给方块
 */
export function isInteractContainerBlock(typeId){
    // 各种材质的展示架
    if (typeId.substring(typeId.length - 6) === '_shelf') {
        return true;
    }
    return BadContainerBlocks.includes(typeId);
}