/**
 * 线性弹幕基类
 * 因为基岩版的实体操作及弹幕的底层实现和java版不同
 * 这里的一些方法只是为了保持接口一致而提供的，只是帮助定义和发射弹幕的工具类而不是弹幕本身
 * (Override方法是用于定义实体的，全部不提供)
 */
import { system } from "@minecraft/server";
export class BulletBase {
    constructor() {
        this.damage = 6; // 伤害
        this.lifeTime = 0; // 已存在的刻数，用来定时销毁
    }
    //////// 构建函数 ////////
    /**
     * 创建子弹实体 实现类也可以自行实现
     */
    createBulletEntity(world, location) {
        let bullet = world.spawnEntity(this.getBulletEntityName(), location);
        this.applyDamage(bullet); // 应用伤害
        this.applyLifeTime(bullet); // 应用留存时间
        return bullet;
    }
    /**
     * 为 弹幕实体 应用伤害
     */
    applyDamage(bulletEntity) {
        bulletEntity.setDynamicProperty("damage", this.damage);
    }
    /**
     * 为 弹幕实体 应用留存时间
     */
    applyLifeTime(bulletEntity) {
        if (this.lifeTime > 0) {
            system.runTimeout(() => {
                try {
                    bulletEntity.triggerEvent("despawn");
                }
                catch (_a) { }
            }, this.lifeTime);
        }
    }
    //////// 设置函数 ////////
    /**
     * 设置伤害数值
     */
    setDamage(damage) {
        this.damage = damage;
        return this;
    }
    /**
     * 设置弹幕的留存时间
     */
    setLifeTime(tick) {
        this.lifeTime = tick;
        return this;
    }
    //////// 实体操作函数 ////////
    /**
     * 弹种类是弹幕实体的接口层，所有的实体操作尽量靠弹种类来执行
     * 便于定义该弹种的实体在进行特定操作时做出的响应
     */
    initVelocity(entity, velocity) {
        entity.applyImpulse(velocity);
    }
    setEntityVelocity(entity, velocity) {
        entity.clearVelocity();
        entity.applyImpulse(velocity);
    }
    applyEntityImpulse(entity, velocity) {
        entity.applyImpulse(velocity);
    }
    //////// Unused ////////
    /**
     * 用于判定两个可驯服实体的主人是否相同
     */
    static hasSameOwner(tameableA, tameableB) {
        var _a, _b;
        return ((_a = tameableA.getComponent('tameable')) === null || _a === void 0 ? void 0 : _a.tamedToPlayerId) ===
            ((_b = tameableB.getComponent('tameable')) === null || _b === void 0 ? void 0 : _b.tamedToPlayerId);
    }
    /**
     * 设置重力大小，暂未实现
     */
    setGravityVelocity(gravity) {
        return this;
    }
}
//# sourceMappingURL=BulletBase.js.map