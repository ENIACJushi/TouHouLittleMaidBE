@echo off
@REM MinecraftPath: C:\Users\XXX\AppData\Local\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe

rmdir /s /q "%MinecraftPath%\LocalState\games\com.mojang\development_behavior_packs\TouHouLittleMaid_BP"
xcopy /I /Q /s /e "..\..\TouHouLittleMaid_BP" "%MinecraftPath%\LocalState\games\com.mojang\development_behavior_packs\TouHouLittleMaid_BP"

rmdir /s /q "%MinecraftPath%\LocalState\games\com.mojang\development_resource_packs\TouHouLittleMaid_RP"
xcopy /I /Q /s /e "..\..\TouHouLittleMaid_RP" "%MinecraftPath%\LocalState\games\com.mojang\development_resource_packs\TouHouLittleMaid_RP"

@REM rmdir /s /q "%MinecraftPath%\LocalState\games\com.mojang\development_resource_packs\TouHouLittleMaid_PBR"
@REM xcopy /I /Q /s /e "..\..\TouHouLittleMaid_PBR" "%MinecraftPath%\LocalState\games\com.mojang\development_resource_packs\TouHouLittleMaid_PBR"

