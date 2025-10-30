@echo off
@REM MinecraftPath: C:\Users\xxx\AppData\Roaming\Minecraft Bedrock\Users\Shared\games\com.mojang

rmdir /s /q "%MinecraftPath%\development_behavior_packs\TouHouLittleMaid_BP"
xcopy /I /Q /s /e "..\..\TouHouLittleMaid_BP" "%MinecraftPath%\development_behavior_packs\TouHouLittleMaid_BP"

rmdir /s /q "%MinecraftPath%\development_resource_packs\TouHouLittleMaid_RP"
xcopy /I /Q /s /e "..\..\TouHouLittleMaid_RP" "%MinecraftPath%\development_resource_packs\TouHouLittleMaid_RP"

@REM rmdir /s /q "%MinecraftPath%\development_resource_packs\TouHouLittleMaid_PBR"
@REM xcopy /I /Q /s /e "..\..\TouHouLittleMaid_PBR" "%MinecraftPath%\development_resource_packs\TouHouLittleMaid_PBR"

