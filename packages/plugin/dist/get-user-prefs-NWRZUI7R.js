import {
  readPrefs
} from "./chunk-MASUZFHP.js";
import "./chunk-F5Y7AP55.js";
import "./chunk-FW6ZW4J3.js";
import "./chunk-YLUEXS7F.js";
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
//# sourceMappingURL=get-user-prefs-NWRZUI7R.js.map