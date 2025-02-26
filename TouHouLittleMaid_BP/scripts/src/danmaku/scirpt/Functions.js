import { Entity } from "@minecraft/server";
import { Vector, VectorMC } from "../../libs/VectorMC";
/**
 *
 * @param {Vector} vec3d
 * @param {float} yawIn
 * @param {float} yOffset
 * @param {Entity} entity
 * @returns {Vector}
 */
export function getRotationVector(vec3d, yawIn, yOffset, entity) {
    let yaw = (entity.getRotation().y + yawIn) * -0.01745329251; // PI/180
    let pos = entity.location;
    let result = VectorMC.rotate_axis(vec3d, new Vector(0, 1, 0), yaw);
    result = VectorMC.add(result, new Vector(pos.x, pos.y + 1 + yOffset, pos.z));
    return result;
}
//# sourceMappingURL=Functions.js.map