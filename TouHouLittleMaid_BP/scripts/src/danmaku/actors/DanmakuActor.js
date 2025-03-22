import { VectorMC } from "../../libs/VectorMC";
export class DanmakuActor {
    setOffset(offset) {
        this.offset = offset;
        return this;
    }
    applyOffset(position) {
        if (this.offset) {
            return VectorMC.add(position, this.offset);
        }
        return position;
    }
}
//# sourceMappingURL=DanmakuActor.js.map