import {
  readPrefs
} from "./chunk-IQ4EWBXE.js";
import "./chunk-FIGO7IPG.js";
import "./chunk-FW6ZW4J3.js";
import "./chunk-UORQZYNI.js";
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
//# sourceMappingURL=get-user-prefs-Z4HGQUNP.js.map