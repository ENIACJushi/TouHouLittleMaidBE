import { DanmakuActor } from "./DanmakuActor";
export class EntityDanmakuActor extends DanmakuActor {
    constructor(entity, isHead = false) {
        super();
        this.isLocationLocked = false;
        this.isHead = isHead;
        this.entity = entity;
        this.lastLocation = [
            this.entity.dimension,
            this.getPosition()
        ];
    }
    /**
     * 锁定发射位置
     */
    lockLocation(dimension, location) {
        this.lastLocation = [dimension, location];
        this.isLocationLocked = true;
        return this;
    }
    /**
     * 解锁发射位置
     */
    unlockLocation() {
        this.isLocationLocked = false;
        return this;
    }
    getLocation() {
        if (this.isLocationLocked) {
            return this.lastLocation;
        }
        if (this.entity) {
            this.lastLocation = [
                this.entity.dimension,
                this.getPosition()
            ];
        }
        return this.lastLocation;
    }
    getPosition() {
        let res;
        if (this.isHead) {
            res = this.entity.getHeadLocation();
        }
        else {
            res = this.entity.location;
        }
        return this.applyOffset(res);
    }
}
//# sourceMappingURL=EntityDanmakuActor.js.map