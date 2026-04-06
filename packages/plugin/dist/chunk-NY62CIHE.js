import {
  CONTEXT_WINDOW_SIZE
} from "./chunk-YLUEXS7F.js";

// lib/core/evidence-extractor.ts
var SKILL_INJECTION_PREFIX = "Base directory for this skill:";
var MAX_BASH_DETAIL_CHARS = 120;
var MAX_TASK_DETAIL_CHARS = 80;
var MAX_ERROR_TEXT_CHARS = 200;
var MAX_URL_DETAIL_CHARS = 120;
function extractToolCallDetail(name, input) {
  switch (name) {
    case "Read":
    case "Edit":
    case "Write": {
      const fp = input["file_path"];
      return typeof fp === "string" ? fp : void 0;
    }
    case "Grep": {
      const pattern = input["pattern"];
      const path = input["path"];
      if (typeof pattern !== "string") return void 0;
      const pathSuffix = typeof path === "string" ? ` in ${path}` : "";
      return `${pattern}${pathSuffix}`;
    }
    case "Glob": {
      const pattern = input["pattern"];
      const path = input["path"];
      if (typeof pattern !== "string") return void 0;
      const pathSuffix = typeof path === "string" ? ` in ${path}` : "";
      return `${pattern}${pathSuffix}`;
    }
    case "Bash": {
      const command = input["command"];
      return typeof command === "string" ? command.slice(0, MAX_BASH_DETAIL_CHARS) : void 0;
    }
    case "Task":
    case "Agent": {
      const desc = input["description"] ?? input["prompt"];
      return typeof desc === "string" ? desc.slice(0, MAX_TASK_DETAIL_CHARS) : void 0;
    }
    case "WebFetch": {
      const url = input["url"];
      return typeof url === "string" ? url.slice(0, MAX_URL_DETAIL_CHARS) : void 0;
    }
    default:
      return void 0;
  }
}
function isAnalyzableUserMessage(message) {
  return message.role === "user" && !message.isMeta && typeof message.sourceToolUseID !== "string" && message.toolUseResult === void 0 && !message.content.trim().startsWith(SKILL_INJECTION_PREFIX);
}
function buildEvidenceContexts(sessions) {
  const contexts = [];
  for (const session of sessions) {
    const sessionStartMs = new Date(session.startTime).getTime();
    let cumulativeErrors = 0;
    let userTurnNumber = 0;
    let precedingAssistantMessageIdx = -1;
    for (let messageIdx = 0; messageIdx < session.messages.length; messageIdx++) {
      const message = session.messages[messageIdx];
      if (message.role === "assistant") {
        for (const toolCall of message.toolCalls ?? []) {
          if (toolCall.isError) {
            cumulativeErrors++;
          }
        }
        precedingAssistantMessageIdx = messageIdx;
      } else if (isAnalyzableUserMessage(message)) {
        userTurnNumber++;
        const utteranceId = `${session.sessionId}_${messageIdx}`;
        const precedingToolSequence = [];
        if (precedingAssistantMessageIdx >= 0) {
          const assistantMsg = session.messages[precedingAssistantMessageIdx];
          for (const toolCall of assistantMsg.toolCalls ?? []) {
            const evidence = {
              name: toolCall.name
            };
            const detail = extractToolCallDetail(toolCall.name, toolCall.input);
            if (detail !== void 0) {
              evidence.detail = detail;
            }
            if (toolCall.isError !== void 0) {
              evidence.isError = toolCall.isError;
            }
            if (toolCall.isError && typeof toolCall.result === "string" && toolCall.result.length > 0) {
              evidence.errorText = toolCall.result.slice(0, MAX_ERROR_TEXT_CHARS);
            }
            precedingToolSequence.push(evidence);
          }
        }
        let contextFillPercent;
        if (precedingAssistantMessageIdx >= 0) {
          const assistantMsg = session.messages[precedingAssistantMessageIdx];
          if (assistantMsg.tokenUsage?.input) {
            const rawPercent = assistantMsg.tokenUsage.input / CONTEXT_WINDOW_SIZE * 100;
            contextFillPercent = Math.min(100, Math.round(rawPercent * 10) / 10);
          }
        }
        let sessionDurationAtTurnSec;
        const messageMs = new Date(message.timestamp).getTime();
        if (Number.isFinite(messageMs) && Number.isFinite(sessionStartMs)) {
          sessionDurationAtTurnSec = Math.max(0, Math.round((messageMs - sessionStartMs) / 1e3));
        }
        const evidenceContext = {
          utteranceId,
          sessionId: session.sessionId,
          timestamp: message.timestamp,
          precedingToolSequence,
          cumulativeErrorCount: cumulativeErrors,
          sessionTurnNumber: userTurnNumber
        };
        if (contextFillPercent !== void 0) {
          evidenceContext.contextFillPercent = contextFillPercent;
        }
        if (sessionDurationAtTurnSec !== void 0) {
          evidenceContext.sessionDurationAtTurnSec = sessionDurationAtTurnSec;
        }
        contexts.push(evidenceContext);
        precedingAssistantMessageIdx = -1;
      }
    }
  }
  return contexts;
}
function buildEvidenceContextIndex(contexts) {
  const index = /* @__PURE__ */ new Map();
  for (const ctx of contexts) {
    index.set(ctx.utteranceId, ctx);
  }
  return index;
}

export {
  buildEvidenceContexts,
  buildEvidenceContextIndex
};
//# sourceMappingURL=chunk-NY62CIHE.js.map