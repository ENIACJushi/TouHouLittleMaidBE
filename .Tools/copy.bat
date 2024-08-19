@echo off

rmdir /s /q "C:\Users\Dell\AppData\Local\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang\development_behavior_packs\TouHouLittleMaid_BP"
xcopy /I /Q /s /e "D:\GitHub\TouHouLittleMaidBE\TouHouLittleMaid_BP" "C:\Users\Dell\AppData\Local\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang\development_behavior_packs\TouHouLittleMaid_BP"

@REM rmdir /s /q "C:\Users\Dell\AppData\Local\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang\development_resource_packs\TouHouLittleMaid_RP"
@REM xcopy /I /Q /s /e "D:\GitHub\TouHouLittleMaidBE\TouHouLittleMaid_RP" "C:\Users\Dell\AppData\Local\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang\development_resource_packs\TouHouLittleMaid_RP"