
const BadContainerBlocks = [
    "minecraft:frame",
    "minecraft:glow_frame",
    "minecraft:decorated_pot"
]

export function isBadContainerBlock(typeId){
    return BadContainerBlocks.includes(typeId);
}