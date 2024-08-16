@echo off

rmdir /s /q "%USERPROFILE%\AppData\Local\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang\development_behavior_packs\TouHouLittleMaid_BP"
xcopy /I /Q /s /e "..\TouHouLittleMaid_BP" "%USERPROFILE%\AppData\Local\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang\development_behavior_packs\TouHouLittleMaid_BP"

rmdir /s /q "%USERPROFILE%\AppData\Local\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang\development_resource_packs\TouHouLittleMaid_RP"
xcopy /I /Q /s /e "..\TouHouLittleMaid_RP" "%USERPROFILE%\AppData\Local\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang\development_resource_packs\TouHouLittleMaid_RP"