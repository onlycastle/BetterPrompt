import {
  readPrefs
} from "./chunk-M3CHNGFP.js";
import "./chunk-RQKQQ22T.js";
import "./chunk-FW6ZW4J3.js";
import "./chunk-VNV2GGMC.js";
import "./chunk-NSBPE2FW.js";

// cli/commands/get-user-prefs.ts
async function execute(_args) {
  return JSON.stringify({
    status: "ok",
    prefs: readPrefs(),
    message: "Loaded BetterPrompt user preferences."
  });
}
export {
  execute
};
//# sourceMappingURL=get-user-prefs-UO7WIJPT.js.map