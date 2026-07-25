# TouHouLittleMaid BE — 脚本与工作流

## 快速开始

```powershell
cd TouHouLittleMaid_BP\typescripts
npm install
npm run build:deploy # 在终端或者.env提前设好环境变量 直接部署到游戏开发目录
npm run build:mcaddon # lint → 类型检查 → 构建 → 打包发布物 在项目根目录的dist
npm run build:watch # 构建+部署后进入监听，改动后自动重建并部署 推荐日常工作流直接用这个
```

```powershell
$env:MinecraftPath = "$env:APPDATA\Minecraft Bedrock\Users\Shared\games\com.mojang"
npm run build:deploy
```

- 当前 **PBR 不打入** `.mcaddon`（仅部署到开发目录）；若发布需要 PBR，请单独分发 `TouHouLittleMaid_PBR`

## 自定义组件（V2）

- 方块 JSON 使用 `"tlm:xxx": {}`（`format_version` ≥ 1.21.90）
- 脚本在 [`src/registerCustomComponents.ts`](src/registerCustomComponents.ts) **顶层**订阅 `system.beforeEvents.startup` 注册
- Content log 里若出现 `tlm:* ... not present in the Schema`：多为静态 Schema 校验噪声，不等于未注册；进世界后应能看到 `[TLM][CC_REGISTER] Custom Components V2 registered ...`
