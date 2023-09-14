import { system, ItemTypes, world, ItemStack, EntityTypes, DynamicPropertiesDefinition, MinecraftEntityTypes, MinecraftBlockTypes } from '@minecraft/server'; 
import backpack from "./backpack_old.js"

world.afterEvents.worldInitialize.subscribe((eventData)=>{
    let def = new DynamicPropertiesDefinition();
    def.defineString("backpackID",12);
    def.defineBoolean("backpackOpen");
    def.defineNumber("backpackSlot");
    def.defineNumber("previousSlot");

    eventData.propertyRegistry.registerEntityTypeDynamicProperties(def, EntityTypes.get("bps:container_entity_temp"));
    eventData.propertyRegistry.registerEntityTypeDynamicProperties(def, MinecraftEntityTypes.player);
})

system.runTimeout(()=>{
    backpack.main()
    world.sendMessage("§e[Backpack+] Addon Loaded!")
},100);
