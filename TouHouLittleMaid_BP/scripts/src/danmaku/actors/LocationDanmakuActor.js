import { world } from "@minecraft/server";
import { DanmakuActor, } from "./DanmakuActor";
import { Vector } from "../../libs/VectorMC";
export class LocationDanmakuActor extends DanmakuActor {
    constructor(dimension, position) {
        super();
        this.dimension = dimension !== null && dimension !== void 0 ? dimension : world.getDimension('overworld');
        this.position = position !== null && position !== void 0 ? position : new Vector(0, 0, 0);
    }
    getLocation() {
        return [this.dimension, this.applyOffset(this.position)];
    }
}
//# sourceMappingURL=LocationDanmakuActor.js.map