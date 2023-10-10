import { Entity } from "@minecraft/server";


export class EntityMaid{
    // 家模式
    static Home = {
        /**
         * 获取home模式
         * @param {Entity} maid 
         */
        getMode(maid){
            return maid.getComponent("minecraft:is_baby")!==undefined;
        },
        /**
         * 切换home模式
         * @param {Entity} maid
         */
        switchMode(maid){
            if(this.getMode(maid)===true){
                // 家模式 → 跟随模式
                this.clearLocation(maid);
                maid.triggerEvent("api:status_quit_home");
                maid.triggerEvent("api:status_follow");
            }
            else{
                // 跟随模式 → 家模式
                this.setLocation(maid);
                maid.triggerEvent("api:status_quit_follow");
                maid.triggerEvent("api:status_home");
            }
        },
        getImg(is_open){
            return is_open?"textures/gui/home_activate.png":"textures/gui/home_deactivate.png"
        },
        getLang(is_open){
            return is_open?"gui.touhou_little_maid:button.home.true.name":"gui.touhou_little_maid:button.home.false.name"
        },
        /**
         * 设置家为当前位置
         * @param {Entity} maid 
         */
        setLocation(maid){
            this.clearLocation(maid);
            let l = maid.location;
            maid.addTag(`thlmh:${Math.ceil(l.x)},${Math.ceil(l.y)},${Math.ceil(l.z)},${maid.dimension.id}`)
        },
        /**
         * 获取家的位置
         * @param {Entity} maid 
         * @returns {number[]|undefined}
         */
        getLocation(maid){
            for(let tag of maid.getTags()){
                if(tag.substring(0, 6) == "thlmh:"){
                    let lstring = tag.substring(6).split(",");
                    return [parseInt(lstring[0]), 
                            parseInt(lstring[1]),
                            parseInt(lstring[2]),
                            lstring[3]];
                }
            }
            return undefined;
        },
        /**
         * 清除家的位置
         * @param {Entity} maid 
         * @returns {number[]|undefined}
         */
        clearLocation(maid){
            for(let tag of maid.getTags()){
                if(tag.substring(0, 6) == "thlmh:"){
                    maid.removeTag(tag);
                }
            }
        }
    }
    // 拾物模式
    static Pick = {
        
    }
}