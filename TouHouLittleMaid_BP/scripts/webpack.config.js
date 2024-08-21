const path = require("path");
const scriptEntry = "src/index.js"; // Entry point of your script

/**
 * @type {import('webpack').Configuration}
 */
module.exports = {
  entry: path.resolve(__dirname, scriptEntry),
  mode: "production",
  target: ["es2020"],
  optimization: {
    minimize: true,
  },
  output: {
    filename: "main.js", // Output filename for the bundled code
    path: path.resolve(__dirname, ""),
  },
  experiments: {
    outputModule: true,
  },
  externalsType: "module",
  externals: {
    "@minecraft/server": "@minecraft/server",
    "@minecraft/server-ui": "@minecraft/server-ui",
    "@minecraft/server-admin": "@minecraft/server-admin",
    "@minecraft/server-gametest": "@minecraft/server-gametest",
    "@minecraft/server-net": "@minecraft/server-net",
    "@minecraft/server-common": "@minecraft/server-common",
    "@minecraft/debug-utilities": "@minecraft/debug-utilities",
  },
};