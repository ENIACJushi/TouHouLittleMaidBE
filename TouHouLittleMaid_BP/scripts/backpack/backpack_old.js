import { system, ItemTypes, world, ItemStack } from '@minecraft/server';   
	
const forbiddenItems = ["bps","shulker_box"];
let playerSize;
let playerIndex = 0;
let hub_loc;

export default class backpack {
	static main(){           
		system.beforeEvents.watchdogTerminate.subscribe((eventData)=>{
			eventData.cancel=true;
			console.warn(
				`[Backpack+ Watchdog] Canceled critical exception of type '${eventData.cancelationReason}`
			);
		});
		
		system.runInterval(()=>{
			let backpackTempCloseQuery = {type:"bps:container_entity_temp",tags:["close"]}
			let backpackTempEntities = world.getDimension("overworld").getEntities(backpackTempCloseQuery)
			for(let entity of backpackTempEntities){				
				entity.removeTag("close")

					let entityTagID = entity.getTags().filter(tag=>tag.includes('bps_id'));
					let limit = 5;
					let itemCount = 0;
					let itemLore = [];
					let backpackInv = entity.getComponent(`inventory`).container;
					for(let slot=0; backpackInv.size>slot; slot++){
						let item = backpackInv.getItem(slot);
						if(!item) continue;
						if(forbiddenItems.filter(forbiddenItem=>item.typeId.includes(forbiddenItem)).length){
							entity.dimension.spawnItem(item,{x:entity.location.x,y:entity.location.y,z:entity.location.z});
							backpackInv.setItem(slot,null);
							continue;
						}				
						let itemName = item.typeId;
						let newName = '';
						let charArr;
						let itemNameArray;
						try{
						itemName = itemName.split(':')[1];
						itemNameArray = itemName.split('_');
						}catch(e){
							continue;
						}
						for(let word of itemNameArray){
							charArr = Array.from(word);
							charArr[0] = charArr[0].toUpperCase();		
							newName += charArr.join("") + " ";
						}				
						itemLore.push(`§7${newName}x${item.amount}`);		
						itemCount++;
						if(itemCount>(backpackInv.size-backpackInv.emptySlotsCount)) break;
					}
					backpackInv = entity.getComponent(`inventory`).container;
					let eQuery = {tags:[entityTagID[0]],type:"bps:container_entity_new"}		
					let getBpMain = world.getDimension(`overworld`).getEntities(eQuery);
					let mainInv = getBpMain[0].getComponent(`inventory`).container;
					updateMainBp(backpackInv,mainInv);					
					
					//Update backpack item inside player inventory
					let playerOwner = getOwnerPlayer(entity.dimension,entity.location);
					if(!playerOwner) return;
					let playerInv = playerOwner.getComponent(`inventory`).container;
						for(let slot=0; 9>slot; slot++){
							let bpItem = playerInv.getItem(slot);
							if(!bpItem) continue;
							if(bpItem.typeId.includes('bp')){
								let idLore = bpItem.getLore().filter(tag=>tag.includes('bps'));
								if(idLore[0] == entityTagID[0]){
									itemLore.unshift(idLore[0]);
									if(itemCount>=5){
									let newLore = itemLore.slice(0,6);
									newLore[6] = "§7and " + (itemCount-5) + " more...";
									bpItem.setLore(newLore);
									playerInv.setItem(slot,bpItem);
									}else{
									bpItem.setLore(itemLore);
									playerInv.setItem(slot,bpItem);
								}
							}
						}
					}				
			}
		},1)		

		system.runInterval(function tick() {
			/*
			* DESPAWN TIMER
			*/
			if(system.currentTick%40 == 0){
				let bpTempQuery = {type:'bps:container_entity_temp'}
				let bpTempEntities = world.getDimension('overworld').getEntities(bpTempQuery);
				for(let bpTempEntity of bpTempEntities){
					let despawn = true
					let backpackIDTag;
					for(let tag of bpTempEntity.getTags()){
						if(tag.includes("bps_id")){
							backpackIDTag = tag
						}
					}
					for(let player of world.getAllPlayers()){
						let item = player.getComponent("inventory").container.getItem(player.selectedSlot)
						if(!item) continue
						if(item.getLore().length<=0) continue
						if(item.getLore()[0].includes(backpackIDTag)){
							despawn = false
						}
					}
					if(despawn){
						bpTempEntity.triggerEvent("despawn2")
					}
				}				
			}

			/*
			* DETECT IF BACKPACK IS KILLED
			*/
			let eQuery = {type:'bps:container_entity_new'}
			let bp = world.getDimension('overworld').getEntities(eQuery);
					
			for(let bag of bp){
				if(bag.getComponent('minecraft:health').currentValue <= 1){
					bag.runCommandAsync(`event entity @s reset_health`);
					bag.getComponent('minecraft:health').resetToMaxValue();
					let noticeItem = new ItemStack(ItemTypes.get('minecraft:paper'),1);
					noticeItem.nameTag = `This backpack has been killed using /kill`;
					bag.getComponent('inventory').container.addItem(noticeItem);
				}
			}

			/*
			* BACKPACK MAIN
			*/
			let allPlayers = world.getAllPlayers()
			playerSize = world.getPlayers().length
			if(playerSize>0){				
				if(playerIndex>=playerSize) playerIndex = 0
				let player = allPlayers[playerIndex]		
				playerIndex++
					
				let mainCentralQuery = {type:'bps:bp_central'}
                let centralEntity = world.getDimension("overworld").getEntities(mainCentralQuery)
                if(centralEntity.length==0){
                    if(player.dimension.id != "minecraft:overworld"){
                        world.sendMessage("[Backpack+] §cMust be in overworld to complete setup.")
                        return
                    }
                    const centralLocation = {x:player.location.x,y:-64,z:player.location.z};
                    let bpCentralEntity = world.getDimension('overworld').spawnEntity(`bps:bp_central`,centralLocation);
                    bpCentralEntity.nameTag = "BP CENTRAL";
					hub_loc = centralLocation
                    world.sendMessage("[Backpack+] §eInitial Setup Complete.")
                }else{
					hub_loc = centralEntity[0].location
				}
							
				let getBackpack = player.getComponent(`inventory`).container.getItem(player.selectedSlot);
				
				
					//Remove tag if empty slot
					if(!getBackpack) {				
						player.removeTag(`open_bps`);
						let slotTag = player.getTags().filter(tag=>tag.includes('bps_slot'));
						let bpId = player.getTags().filter(tag=>tag.includes('bps_id'));
						if(slotTag.length<=0) return;	
						if(slotTag.length>0){
							//player.runCommandAsync("say dropped");
							//let oldSlotBP = playerInv.getItem(parseInt(slotTag[0].split(':')[1]));
							//let slotBP = parseInt(slotTag[0].split(':')[1]);
							drop_closeBackPack(player,bpId[0]);
							player.removeTag(bpId[0]);
							player.removeTag(slotTag[0]);
							//for(let tag of bpsTags){
							//	player.removeTag(tag);
							//}
							//if (!oldSlotBP) return;
							//unlockBackPack(player,oldSlotBP,slotBP);
						}
						return;
					}
					let bpsTag = Array.from(player.getTags()).filter(tag=>tag.includes(`open_bps`));	
					let bpSize;	
					let switchBP = '';
					switch(getBackpack.typeId){
						case "bps:backpack_xl":
							var pId = player.getTags().filter(tag=>tag.includes(`bps_id`));
							switchBP = getBackpack.getLore()[0];
							if(switchBP != pId){
								closeBackPack(player);	
							}
							if(switchBP) player.addTag(switchBP);
							bpSize = "xl";
							mainBackpack(bpSize,getBackpack.typeId,bpsTag,player,getBackpack);
						break;
						
						case "bps:backpack_medium":
							
							var pId = player.getTags().filter(tag=>tag.includes(`bps_id`));
							switchBP = getBackpack.getLore()[0];
							if(switchBP != pId){
								closeBackPack(player);	
							}
							if(switchBP) player.addTag(switchBP);
							bpSize = "medium";
							mainBackpack(bpSize,getBackpack.typeId,bpsTag,player,getBackpack);
						break;
						
						case "bps:backpack_big":
							
							var pId = player.getTags().filter(tag=>tag.includes(`bps_id`));
							switchBP = getBackpack.getLore()[0];
							if(switchBP != pId){
								closeBackPack(player);	
							}
							if(switchBP) player.addTag(switchBP);
							bpSize = "big";
							mainBackpack(bpSize,getBackpack.typeId,bpsTag,player,getBackpack);
						break;
						
						case "bps:backpack":
							
							var pId = player.getTags().filter(tag=>tag.includes(`bps_id`));
							switchBP = getBackpack.getLore()[0];
							if(switchBP != pId){
								closeBackPack(player);	
							}
							if(switchBP) player.addTag(switchBP);
							bpSize = "small";
							mainBackpack(bpSize,getBackpack.typeId,bpsTag,player,getBackpack);
						break;
						
						default:							
							closeBackPack(player);
													
					}
			}													
		},1);

		function getOwnerPlayer(dimension,location){
			let newLocation = {x:location.x,y:location.y,z:location.z};
			let eQuery = {type:'minecraft:player',location:newLocation,closest:1}
			let player = dimension.getEntities(eQuery);
			if(player.length>0){
				return player[0];
			}else{
				return false;
			}
		}

		function drop_closeBackPack(player,bpTag){
				let eQuery = {tags:[bpTag],type:"bps:container_entity_new"}	
				let eQuery2 = {tags:[bpTag],type:"bps:container_entity_temp"}
				let getBpMain = world.getDimension(`overworld`).getEntities(eQuery);
				let getBpTemp = world.getDimension(`overworld`).getEntities(eQuery2);
				if(getBpTemp.length <= 0 || getBpMain.length <= 0) return;
				let tempInv = getBpTemp[0].getComponent(`inventory`).container;
				let mainInv = getBpMain[0].getComponent(`inventory`).container;
					for(let index=0; index<tempInv.size; index++){
						let item = tempInv.getItem(index);
						if(!item) continue;
						if(item.typeId.includes("bps:")){					
							player.dimension.spawnItem(item,{x:player.location.x,y:player.location.y,z:player.location.z});					
							tempInv.setItem(index,null);	
						}
					}
				tempInv = getBpTemp[0].getComponent(`inventory`).container;
				updateMainBp(tempInv,mainInv);
				player.runCommandAsync(`event entity @e[type=bps:container_entity_temp,tag="${bpTag}"] despawn2`);
		}

		function closeBackPack(player){
			player.removeTag(`open_bps`);		
			let slotTag = player.getTags().filter(tag=>tag.includes('bps_slot'));
			let idTag = player.getTags().filter(tag=>tag.includes('bps_id'));
			if(slotTag.length>0){
				let playerInv = player.getComponent(`inventory`).container;
				let oldSlotBP = playerInv.getItem(parseInt(slotTag[0].split(':')[1]));
				let slotBP = parseInt(slotTag[0].split(':')[1]);
				let oldBPID = oldSlotBP.getLore()[0];
				let bpsTags = player.getTags().filter(tag=>tag.includes('bps'));
				for(let tag of bpsTags){
					player.removeTag(tag);
				}
				//unlockBackPack(player,oldSlotBP,slotBP);
				let eQuery = {tags:[idTag[0]],type:"bps:container_entity_new"}	
				let eQuery2 = {tags:[idTag[0]],type:"bps:container_entity_temp"}
				let getBpMain = world.getDimension(`overworld`).getEntities(eQuery);
				let getBpTemp = world.getDimension(`overworld`).getEntities(eQuery2);
				if(getBpTemp.length <= 0) return;
				let tempInv = getBpTemp[0].getComponent(`inventory`).container;
				let mainInv = getBpMain[0].getComponent(`inventory`).container;
				updateMainBp(tempInv,mainInv);
				player.runCommandAsync(`event entity @e[type=bps:container_entity_temp,tag="${oldBPID}"] despawn2`);
				//player.runCommandAsync(`execute @s[tag=bps_portal] ~ ~ ~ tp @e[type=bps:container_entity_new] ~ 127 ~`);		
			}
		}

		function avoidDuplicateID(id){
			let alphabetAdd = ["A","C","D","E","F","G","H","I","J"];
			let eQuery = {type:`bps:container_entity_new`}
			let entitiesEnd = world.getDimension(`overworld`).getEntities(eQuery);
			let entitiesNether = world.getDimension(`overworld`).getEntities(eQuery);
			let entities = world.getDimension(`overworld`).getEntities(eQuery);
			entities.concat(entitiesNether);
			entities.concat(entitiesEnd);
				for(let entity of entities){
					let tags = entity.getTags();
					for(let tag of tags){
						if(tag == id){
							return "bps_id:" + alphabetAdd[Math.floor(Math.random()* 7)] + alphabetAdd[Math.floor(Math.random()* 7)] + Math.floor(Math.random()* 10000);
						}
					}
				}
			return id;
		}

		function mainBackpack(bpSize,bpId,bpsTag,player,getBackpack){
			if(getBackpack.getLore().length<=0 || getBackpack.getLore()[0].includes('bps')){
			let backPackUID = getBackpack.getLore()[0];
			if(bpsTag.length<=0){
				let backpackItemLore = getBackpack.getLore();
				if(backpackItemLore.length>0){
					player.addTag(`open_bps`);
					player.addTag(`bps_slot:${player.selectedSlot}`);
					//lockBackPack(player,getBackpack);
					try{
					setupBackpackTempInventory(backPackUID,player.dimension,player.location,bpSize);
					}catch(e){
						player.runCommandAsync(`tellraw @s {"rawtext":[{"text":"[Backpack+] §c${e}."}]}`);
						return;
					}
				}else{			
					let newBackPack = backpackSetup(getBackpack);
					player.getComponent(`inventory`).container.setItem(player.selectedSlot,undefined);
					player.getComponent(`inventory`).container.setItem(player.selectedSlot,newBackPack);
					//lockBackPack(player,getBackpack);
					backPackUID = newBackPack.getLore()[0];
					setupBackpackInventory(backPackUID,player.dimension,player.location,bpSize);								
				}
			}else{					
				let playerLocation = player.location	
				let block = player.dimension.getBlock(playerLocation)
				playerLocation.y += 1.5
				if(backPackUID == undefined) return
				let bpQuery = {type:"bps:container_entity_temp",tags:[backPackUID]}
				let bpEntityTemp = player.dimension.getEntities(bpQuery)
				for(let bpEnt of bpEntityTemp){
					bpEnt.teleport(playerLocation)
					bpEnt.triggerEvent("timeout")
				}
				if(block){
					if(block.typeId.includes("portal")){
						for(let bpEnt of bpEntityTemp){
							bpEnt.triggerEvent("despawn2")
						}													
					}	
				}				
			}
			}
		}

		function backpackSetup(backpackItem){
			let currentLore = backpackItem.getLore();
			currentLore[0] = "bps_id:" + Math.floor(Math.random()* 10000);
			currentLore[0] = avoidDuplicateID(currentLore[0]);
			backpackItem.setLore(currentLore);
			return backpackItem;
		}

		function setupBackpackInventory(bpId,currentDimension,currentLocation,bpSize){
			let backpackContainerEntity = world.getDimension(`overworld`).spawnEntity(`bps:container_entity_new`,hub_loc);
			if(bpSize == 'small'){
				backpackContainerEntity.nameTag = "Small Backpack";
			}else if(bpSize == 'medium'){
				backpackContainerEntity.nameTag = "Medium Backpack";	
			}else if(bpSize == 'big'){
				backpackContainerEntity.nameTag = "Big Backpack";		
			}else if(bpSize == 'xl'){
				backpackContainerEntity.nameTag = "XL Backpack";		
			}else{
				backpackContainerEntity.nameTag = "Backpack";	
			}
			//backpackContainerEntity.addTag(bpSize);
			backpackContainerEntity.addTag(bpId);		
			backpackContainerEntity.runCommandAsync(`event entity @s ${bpSize}`);
			//Scrapped code due to dying in some servers
			//backpackContainerEntity.kill();
			//backpackContainerEntity.getComponent('minecraft:health').resetToMaxValue;
			backpackContainerEntity.runCommandAsync(`tp @s @e[type=bps:bp_central,c=1]`);
		}

		function setupBackpackTempInventory(bpId,currentDimension,currentLocation,bpSize){
			let newLocation = {x:currentLocation.x,y:currentLocation.y+1.5,z:currentLocation.z};
			let backpackContainerEntity = currentDimension.spawnEntity(`bps:container_entity_temp`,newLocation);
			if(bpSize == 'small'){
				backpackContainerEntity.nameTag = "Small Backpack";
			}else if(bpSize == 'medium'){
				backpackContainerEntity.nameTag = "Medium Backpack";	
			}else if(bpSize == 'big'){
				backpackContainerEntity.nameTag = "Big Backpack";		
			}else if(bpSize == 'xl'){
				backpackContainerEntity.nameTag = "XL Backpack";		
			}else{
				backpackContainerEntity.nameTag = "Backpack";	
			}
			backpackContainerEntity.addTag(bpId);			
			backpackContainerEntity.triggerEvent(bpSize);
			//backpackContainerEntity.kill();
			
			const eQuery = {tags:[bpId],type:"bps:container_entity_new"}
			let getBpMain = world.getDimension(`overworld`).getEntities(eQuery);
			let tempInv = backpackContainerEntity.getComponent(`inventory`).container;
			let mainInv;
			try{
			mainInv = getBpMain[0].getComponent(`inventory`).container;
			}catch(e){
				backpackContainerEntity.runCommandAsync(`event entity @e[tag="${bpId}",type=bps:container_entity_temp] despawn2`);
				throw "Main Backpack Unable To Be Found. Please do 'bp reset' while holding this backpack";
				return;
			}
			
			updateTempBp(tempInv,mainInv);
		}

		function updateTempBp(tempBpInv,mainBpInv){
			for(let slot=0; mainBpInv.size>slot; slot++){
				let item = mainBpInv.getItem(slot);
				if(!item) continue;
				tempBpInv.setItem(slot,item);
			}	
		}

		function updateMainBp(tempBpInv,mainBpInv){
			for(let slot=0; mainBpInv.size>slot; slot++){
				mainBpInv.setItem(slot,null);
			}	
			for(let slot=0; tempBpInv.size>slot; slot++){
				let item = tempBpInv.getItem(slot);
				if(!item) continue;
				mainBpInv.setItem(slot,item);
			}	
		}

		world.afterEvents.playerLeave.subscribe((eventData)=>{
			world.getDimension(`overworld`).runCommandAsync(`event entity @e[type=bps:container_entity_temp] timeout`);
		});

		/*
		* syntax: reset bp
		* syntax: bp clean <all/temps/backpack>
		* syntax: bp drop <backpack id: number>
		* syntax: bp view <backpack id: number>
		* syntax: bp list
		*/

		world.beforeEvents.chatSend.subscribe((eventData)=>{
			let commandArr = eventData.message.trim().split(' ');
			let command = commandArr[0] + ' ' + commandArr[1];
			system.run(()=>{
				switch(command){
				
					case "bp clean":
						if(commandArr[2] == "all"){
						eventData.sender.runCommandAsync(`function reset`);
						eventData.sender.runCommandAsync(`tellraw @s {"rawtext":[{"text":"[Backpack+] §eSuccesfully reset the addon. Restart you world or server to begin setup again."}]}`);
						}else if(commandArr[2] == "temps"){
						eventData.sender.runCommandAsync(`event entity @e[type=bps:container_entity_temp] despawn2`);
						eventData.sender.runCommandAsync(`tellraw @s {"rawtext":[{"text":"[Backpack+] §eRemoved all temporary backpack entities."}]}`);	
						}else if(commandArr[2] == "backpack"){
						eventData.sender.runCommandAsync(`event entity @e[type=bps:container_entity_new] despawn2`);	
						eventData.sender.runCommandAsync(`tellraw @s {"rawtext":[{"text":"[Backpack+] §eRemoved all backpack entities."}]}`);
						}else{
						eventData.sender.runCommandAsync(`tellraw @s {"rawtext":[{"text":"[Backpack+] §a>>bp clean syntaxes<<\n-bp clean all\n-bp clean temps\n-bp clean backpack"}]}`);	
						}
						eventData.cancel = true;
					break;
					
					case "bp reset":					
						eventData.cancel = true;
						let item = eventData.sender.getComponent(`inventory`).container.getItem(eventData.sender.selectedSlot);
						if(!item){
							eventData.sender.sendMessage(`[Backpack+] §cMust be a backpack.`);
							return;
						}
						if(!item.typeId.includes('bps')){
							eventData.sender.sendMessage(`[Backpack+] §cMust be a backpack.`);
							return;
						}
						let bpId = item.getLore()[0];
						eventData.sender.runCommandAsync(`event entity @e[tag="${bpId}"] despawn2`);
						eventData.sender.getComponent(`inventory`).container.setItem(eventData.sender.selectedSlot, undefined);
						system.runTimeout(()=>{																
							eventData.sender.getComponent(`inventory`).container.setItem(eventData.sender.selectedSlot, new ItemStack(ItemTypes.get(item.typeId),1));						
							eventData.sender.sendMessage(`[Backpack+] §eSuccesfully reset backpack.`);
						},1)	
					break;
					
					case "bp central":
						eventData.cancel = true;
						if(eventData.sender.getTags().filter(tag=>tag == 'op').length<=0){
							eventData.sender.runCommandAsync(`tellraw @s {"rawtext":[{"text":"[Backpack+] §cMust be an OP to use this command."}]}`);
							return;
						}
						let eQuery = {type:`bps:bp_central`}
						let bpCentral = world.getDimension(`overworld`).getEntities(eQuery);
						if(bpCentral.length>0){
							let bpl = bpCentral[0].location;
							eventData.sender.runCommandAsync(`tellraw @s {"rawtext":[{"text":"[Backpack+] §eBackpack Central Location: ${Math.floor(bpl.x)},${Math.floor(bpl.y)},${Math.floor(bpl.z)}"}]}`);
						}else{
							eventData.sender.runCommandAsync(`tellraw @s {"rawtext":[{"text":"[Backpack+] §cBackpack Central Location: Not Found`);
						}
					break;
					
					case "bp move":
						eventData.cancel = true;
						if(eventData.sender.getTags().filter(tag=>tag == 'op').length<=0){
							eventData.sender.runCommandAsync(`tellraw @s {"rawtext":[{"text":"[Backpack+] §cMust be an OP to use this command."}]}`);
							return;
						}
						if(!eventData.sender.dimension.id.includes('overworld')){
							eventData.sender.runCommandAsync(`tellraw @s {"rawtext":[{"text":"[Backpack+] §cThis command can only be used in the overworld."}]}`);
							return;
						}
						let pl = eventData.sender.location;
						let nl = {x:pl.x,y:-64,z:pl.z};
						eventData.sender.runCommandAsync(`tp @e[type=bps:bp_central] ${nl.x} ${nl.y} ${nl.z}`);
						eventData.sender.runCommandAsync(`tp @e[type=bps:container_entity_new] ${nl.x} ${nl.y} ${nl.z}`);
						let eQuery2 = {type:`bps:bp_central`}
						let bpCentral2 = Array.from(world.getDimension(`overworld`).getEntities(eQuery2));
						if(bpCentral2.length>0){
							eventData.sender.runCommandAsync(`tellraw @s {"rawtext":[{"text":"[Backpack+] §eBackpack New Central Location: ${Math.floor(nl.x)},${Math.floor(nl.y)},${Math.floor(nl.z)}"}]}`);
						}
					break;
					
					case "bp update":
						eventData.cancel = true;
						eventData.sender.runCommandAsync(`tellraw @s {"rawtext":[{"text":"[Backpack+] §cThis command is no longer available."}]}`);
					break;
					
					case "bp drop":
						eventData.cancel = true;
						if(eventData.sender.hasTag("op")){
						let bpID = eventData.message.trim().split(` `)[2];
						if(!bpID){
							eventData.sender.runCommandAsync(`tellraw @s {"rawtext":[{"text":"[Backpack+] §cPut a backpack id."}]}`);
							return;
						}
						let eQuery = {tags:[`bps_id:${bpID}`],excludeFamilies:[`player`]}
						let bp = eventData.sender.dimension.getEntities(eQuery);
						if(bp.length>0) {
							for(let bpEntity of bp){
								bpEntity.teleport(eventData.sender.location)
								bpEntity.triggerEvent("drop")
								bpEntity.triggerEvent("despawn2")
							}							
							eventData.sender.sendMessage(`[Backpack+] §eSuccesfully dropped backpack contents.`);
						}else{
							eventData.sender.sendMessage(`[Backpack+] §cNo backpacks with that ID found.`);
						}
					}else{
						eventData.sender.sendMessage(`[Backpack+] §cMust be an OP to use this command.`);
					}
					break;
					
					case "bp view":
						eventData.cancel = true;
						if(eventData.sender.getTags().filter(tag=>tag == 'op').length>0){
							if(!commandArr[2]){
								eventData.sender.runCommandAsync(`tellraw @s {"rawtext":[{"text":"[Backpack+] §cPut a backpack id."}]}`);
								return;
							}
							let eQuery = {type:'bps:container_entity_new',tags:[`bps_id:${commandArr[2]}`]}
							let bp = eventData.sender.dimension.getEntities(eQuery);
							if(bp.length>0) {
								let itemList = "§eBackpack Items: ";
								let bpInv = bp[0].getComponent('inventory').container;
								for(let slot=0; bpInv.size>slot; slot++){
									let item = bpInv.getItem(slot);
									if(!item) continue;
									
									let itemName = item.typeId;
									let newName = '';
									let charArr;
									let itemNameArray;
									try{
									itemName = itemName.split(':')[1];
									itemNameArray = itemName.split('_');
									}catch(e){
										continue;
									}
									for(let word of itemNameArray){
										charArr = Array.from(word);
										charArr[0] = charArr[0].toUpperCase();		
										newName += charArr.join("") + " ";
									}										
									itemList = itemList + `${newName}` + " x" + `${item.amount}` + ",";
								}
								eventData.sender.runCommandAsync(`tellraw @s {"rawtext":[{"text":"[Backpack+] ${itemList}"}]}`);
							}else{
								eventData.sender.runCommandAsync(`tellraw @s {"rawtext":[{"text":"[Backpack+] §cNo backpacks with that ID found."}]}`);
							}
						}else{
							eventData.sender.runCommandAsync(`tellraw @s {"rawtext":[{"text":"[Backpack+] §cMust be an OP to use this command."}]}`);
						}
					break;
					
					case "bp list":
						eventData.cancel = true;
						if(eventData.sender.getTags().filter(tag=>tag == 'op').length>0){
							let eQuery = {type:'bps:container_entity_new'}
							let bp = eventData.sender.dimension.getEntities(eQuery);
							let bpList = "Backpack IDs: §e";
							for(let bag of bp){
								let id = bag.getTags()[0].split(':')[1];
								bpList = bpList + `${id}` + ',';
							}
						eventData.sender.runCommandAsync(`tellraw @s {"rawtext":[{"text":"[Backpack+] ${bpList}"}]}`);
						}else{
							eventData.sender.runCommandAsync(`tellraw @s {"rawtext":[{"text":"[Backpack+] §cMust be an OP to use this command."}]}`);
						}
					break;
				}
			})
				
		});
	}
}