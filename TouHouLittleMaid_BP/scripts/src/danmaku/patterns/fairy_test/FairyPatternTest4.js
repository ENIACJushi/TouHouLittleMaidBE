import { system } from "@minecraft/server";
import { GoheiCherry } from "../../../items/GoheiCherry";
export class FairyPatternTest4 {
    shoot(thrower) {
        GoheiCherry.shoot(thrower, undefined);
        for (let i2 = 0; i2 < 0; i2++) {
            system.runTimeout(() => {
                for (let i = 0; i < 5; i++) {
                    GoheiCherry.shoot(thrower, undefined);
                }
            }, i2);
        }
        return true;
    }
}
//# sourceMappingURL=FairyPatternTest4.js.map