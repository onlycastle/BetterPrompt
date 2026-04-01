import {
  readPrefs
} from "./chunk-TFWQ7CTM.js";
import "./chunk-66MDY4NM.js";
import "./chunk-FW6ZW4J3.js";
import "./chunk-HGESGWN4.js";
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
//# sourceMappingURL=get-user-prefs-MWHYJOSV.js.map