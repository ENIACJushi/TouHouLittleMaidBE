import { DanmakuActor } from "./DanmakuActor";
export class BlockDanmakuActor extends DanmakuActor {
    constructor(block) {
        super();
        this.block = block;
        this.location = [block.dimension, block.location];
    }
    getLocation() {
        return [this.location[0], this.applyOffset(this.location[1])];
    }
}
//# sourceMappingURL=BlockDanmakuActor.js.map