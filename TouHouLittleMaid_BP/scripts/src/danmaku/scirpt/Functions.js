import { Entity } from "@minecraft/server";
import { rotate_axis, add } from "../../libs/vector3d"

/**
 * 
 * @param {float} x 
 * @param {float} y 
 * @param {float} z 
 * @param {float} yawIn 
 * @param {float} yOffset 
 * @param {Entity} entity
 */
export function getRotationVector(x, y, z, yawIn, yOffset, entity){
    let yaw = (entity.getRotation().y + yawIn) * -0.01745329251;// PI/180
    let pos = entity.location;

    let vec3d = [x, y, z]
    vec3d = rotate_axis(vec3d, [0,1,0], yaw);
    vec3d = add(vec3d, [pos.x, pos.y + 1 + yOffset, pos.z]);
    
    return vec3d;
}