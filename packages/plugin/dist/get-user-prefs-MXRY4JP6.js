import {
  readPrefs
} from "./chunk-BOYAIPQA.js";
import "./chunk-SE3623WC.js";
import "./chunk-FW6ZW4J3.js";
import "./chunk-SVAMHER4.js";
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
//# sourceMappingURL=get-user-prefs-MXRY4JP6.js.map