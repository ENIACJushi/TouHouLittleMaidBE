import { BulletBase } from "./BulletBase";
import { Vector } from "../../../libs/VectorMC";
export class Amulet extends BulletBase {
    getBulletEntityName() {
        return 'thlmd:bullet_amulet';
    }
    createBulletEntity(world, location) {
        let bullet = super.createBulletEntity(world, location);
        this.applyRotation(bullet, new Vector(0, 0, 0));
        return bullet;
    }
    /**
     * 设置旋转角(用于试验渲染是否正常，暂无实际作用)
     */
    applyRotation(entity, speed) {
        entity.setProperty('thlm:r_x', 30);
    }
}
//# sourceMappingURL=Amulet.js.map