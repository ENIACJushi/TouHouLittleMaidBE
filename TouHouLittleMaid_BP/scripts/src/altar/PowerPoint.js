import { Player, world, Dimension, Entity, WorldInitializeAfterEvent, EntityTypes, ItemComponentRegistry, WorldInitializeBeforeEvent } from "@minecraft/server";
import { Vector } from "../libs/VectorMC";
import * as Tool from "../libs/ScarletToolKit";
class PowerPoint {
    /**
     * @param {WorldInitializeBeforeEvent} event
     */
    static registerCC(event) {
        // 初始化 P 点投掷物属性
        event.itemComponentRegistry.registerCustomComponent('tlm:power_point', {
            onUse(useEvent) {
                let pl = useEvent.source;
                Tool.ItemTool.decrementMainHandStack(pl);
                // 发射物品
                let projectile = pl.dimension.spawnEntity("touhou_little_maid:power_point", pl.getHeadLocation());
                let component = projectile.getComponent("projectile");
                component.owner = pl;
                component.shoot(pl.getViewDirection());
            }
        });
    }
    //////// INIT ////////
    /**
     * @param {WorldInitializeBeforeEvent} event
     */
    static init(event) {
        // 初始化计分板
        if (world.scoreboard.getObjective("p") == null) {
            world.getDimension("overworld").runCommand("scoreboard objectives add p dummy power");
        }
    }
    /**
     *
     * @param {Entity} en
     */
    static init_power_point(en) {
        en.applyImpulse(this.get_velocity_power_point());
    }
    /**
     *
     * @param {Entity} en
     * @param {Dimension} dimension
     */
    static powerpoint_hit(en, dimension) {
        // int count = 30 + this.level.random.nextInt(30) + this.level.random.nextInt(30);
        // may outside of the world
        try {
            // may inside a block
            let summon_location = en.location;
            if (dimension.getBlock(en.location).typeId != "minecraft:air") {
                summon_location = new Vector(en.location.x, Math.ceil(en.location.y), en.location.z);
            }
            this.summon_power_velocity(Math.ceil(Tool.getRandom(30, 90)), dimension, summon_location, [en.getVelocity().x / 2, 0, en.getVelocity().z / 2]);
            dimension.spawnParticle("touhou_little_maid:splash_power_point", summon_location);
        }
        catch (_a) { }
        en.triggerEvent("despawn");
    }
    /**
     *
     * @param {Entity} en
     */
    static fairy_death(en) {
        en.dimension.spawnEntity("touhou_little_maid:p_point", en.location).triggerEvent("init_p1");
        en.dimension.spawnEntity("touhou_little_maid:p_point", en.location).triggerEvent("init_p1");
        en.dimension.spawnEntity("touhou_little_maid:p_point", en.location).triggerEvent("init_p3");
        en.dimension.spawnEntity("touhou_little_maid:p_point", en.location).triggerEvent("init_p3");
    }
    /**
     * Scan power point near the player
     * @param {Player} pl
     */
    static scan_power_point(pl) {
        const results = pl.dimension.getEntities({
            type: 'touhou_little_maid:p_point',
            maxDistance: this.power_point_distance,
            location: pl.location
        });
        for (let en of results) {
            try {
                if (en.getDynamicProperty("target") === undefined) {
                    en.triggerEvent("scan_start");
                    en.setDynamicProperty("target", pl.id);
                }
            }
            catch (_a) {
            }
        }
    }
    /**
     * Show power number to player by title at action bar
     * @param {Player} pl
     */
    static show(pl) {
        Tool.title_player_actionbar(pl.name, `§cP: ${(this.get_power_number(pl) / 100).toFixed(2)}`);
    }
    /**
     * Set the vector of power point to player
     * @param {Entity} en
     */
    static scan_powerpoint(en) {
        // 获取目标玩家
        let pl = undefined;
        let player_id = en.getDynamicProperty("target");
        if (player_id === undefined) {
            const results = en.dimension.getPlayers({ "closest": 1 });
            if (results.length >= 1) {
                pl = results[0];
                en.setDynamicProperty("target", pl.id);
            }
            else {
                return;
            }
        }
        else {
            pl = world.getEntity(player_id);
        }
        // 设置方向
        if (pl === undefined) {
            en.setDynamicProperty("target", undefined);
            // en.triggerEvent("scan_stop");
        }
        else {
            let pl_headLocation = pl.getHeadLocation();
            let delta_y = pl_headLocation.y - en.location.y;
            // Follow box (xzy) x-z-7
            let delta_x = pl_headLocation.x - en.location.x;
            let delta_z = pl_headLocation.z - en.location.z;
            let distance = Math.sqrt(delta_x * delta_x + delta_z * delta_z);
            if (-1 * this.power_point_distance < distance && distance < this.power_point_distance
                && -5 < delta_y && delta_y < 6) {
                // Score box (xzy): 3 × 3 × 4
                if (-1 < delta_x && delta_x < 1
                    && -1 < delta_z && delta_z < 1
                    && -2 < delta_y && delta_y < 1) {
                    // PS. Fariy loot: 2*0p + 2*2p (16 points)
                    let point_score = this.get_power_number(pl);
                    // If this power point has tag, add by tag number
                    let is_taged = false;
                    for (let tag of en.getTags()) {
                        if (tag.substring(0, 6) == "thlm:p") {
                            point_score += parseInt(tag.substring(6));
                            is_taged = true;
                            break;
                        }
                    }
                    // If not, add by default
                    if (!is_taged) {
                        switch (en.getComponent("minecraft:variant").value) {
                            case 0:
                                point_score += 1;
                                break;
                            case 1:
                                point_score += 4;
                                break;
                            case 2:
                                point_score += 7;
                                break;
                            case 3:
                                point_score += 10;
                                break;
                            case 4:
                                point_score += 500;
                                break;
                            default: break;
                        }
                    }
                    if (point_score > 500) {
                        // 转化为经验
                        pl.runCommand(`xp ${point_score - 500} @s`);
                    }
                    this.set_power_number(pl.name, Math.min(500, point_score));
                    pl.dimension.runCommand(`playsound power_pop ${Tool.playerCMDName(pl.name)}`);
                    en.triggerEvent("despawn");
                }
                // ​If not in the score box, do storm suction
                else {
                    let velocity_xz = (distance > 1)
                        ? (this.power_point_max_speed - distance * (this.power_point_max_speed / this.power_point_distance))
                        : (distance * (this.power_point_max_speed / this.power_point_distance));
                    let v_x = velocity_xz * (delta_x / distance);
                    let v_z = velocity_xz * (delta_z / distance);
                    let v_y = en.getVelocity().y - 0.036; // gravity
                    if (-1.5 < delta_x && delta_x < 1.5
                        && -1.5 < delta_z && delta_z < 1.5
                        && delta_y > 1) {
                        v_y = (delta_y > 0) ? (0.5 - delta_y * 0.025) : (delta_y * 0.3);
                    }
                    en.clearVelocity();
                    en.applyImpulse(new Vector(v_x, v_y, v_z));
                }
            }
            else {
                // en.triggerEvent("scan_stop");
                en.setDynamicProperty("target", undefined);
            }
        }
    }
    /**
     * 检测玩家的p点计分板是否已经初始化，若没有则返回false
     * 用于首次入服的检测
     * @param {string} name
     * @returns {boolean}
     */
    static test_power_number(name) {
        let scores = world.scoreboard.getObjective("p").getScores();
        for (let s of scores) {
            if (s.participant.displayName == name) {
                return true;
            }
        }
        return false;
    }
    /**
     * Get player power point number in scoreboard (xxx)
     * @param {Player} player
     * @returns {interger}
     */
    static get_power_number(player) {
        let score = world.scoreboard.getObjective("p").getScore(player);
        if (score !== undefined)
            return score;
        world.getDimension("overworld").runCommand(`scoreboard players add ${Tool.playerCMDName(player.name)} p 0`);
        return 0;
    }
    /**
     * Set player power point number (xxx)
     * @param {string} name
     * @param {interger} number
     */
    static set_power_number(name, number) {
        world.getDimension("overworld").runCommand(`scoreboard players set ${Tool.playerCMDName(name)} p ${number}`);
    }
    /**
     *
     * @param {number} count
     * @param {Dimension} dimension
     * @param {Location} location
     * @param {Array} velocity
     */
    static summon_power_velocity(count_, dimension, location, velocity) {
        let count = count_;
        const overworld = world.getDimension("overworld");
        while (true) {
            let temp = dimension.spawnEntity("touhou_little_maid:p_point", location);
            let drectionX = Tool.getRandom() < 0.5 ? 1 : -1;
            let drectionZ = Tool.getRandom() < 0.5 ? 1 : -1;
            temp.applyImpulse(this.get_velocity_power_point(velocity));
            if (count >= 32) {
                temp.triggerEvent("init_ns_p4");
                temp.addTag("thlm:p32");
                count -= 32;
            }
            else if (count >= 16) {
                temp.triggerEvent("init_ns_p4");
                temp.addTag("thlm:p16");
                count -= 16;
            }
            else if (count >= 10) {
                temp.triggerEvent("init_ns_p4");
                count -= 10;
            }
            else if (count >= 7) {
                temp.triggerEvent("init_ns_p3");
                count -= 7;
            }
            else if (count >= 4) {
                temp.triggerEvent("init_ns_p2");
                count -= 4;
            }
            else if (count >= 0) {
                temp.triggerEvent("init_ns_p1");
                count -= 1;
            }
            if (count <= 0)
                return true;
        }
        return false;
    }
    static get_velocity_power_point(base_velocity = [0, 0, 0]) {
        let drectionX = Tool.getRandom() < 0.5 ? 1 : -1;
        let drectionZ = Tool.getRandom() < 0.5 ? 1 : -1;
        return new Vector(base_velocity[0] + drectionX * Tool.getRandom(0, 0.4), // xp_orb 0~0.2
        base_velocity[1] + Tool.getRandom(0, 0.8), // xp_orb 0~0.4
        base_velocity[2] + drectionZ * Tool.getRandom(0, 0.4)); // xp_orb 0~0.2
    }
}
PowerPoint.power_point_distance = 8;
PowerPoint.power_point_max_speed = 1;
export default PowerPoint;
//# sourceMappingURL=PowerPoint.js.map