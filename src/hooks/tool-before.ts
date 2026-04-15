import type { Hooks } from "@opencode-ai/plugin";
import { isAllowlisted } from "@/rules/allowlist";
import type { SharedState } from "@/hooks/shared-state";

export const createToolBeforeHook = (state: SharedState): NonNullable<Hooks["tool.execute.before"]> => {
  return async (input, output) => {
    if (!state.pipeline || !state.config) {
      return;
    }
    if (state.recursionGuard.isEvaluating(input.callID)) {
      return;
    }
    if (isAllowlisted(input.tool, state.config)) {
      return;
    }

    if (state.config.loop_prevention.enabled) {
      const callHash = JSON.stringify({ t: input.tool, a: output.args });
      state.toolHistory.push(callHash);
      if (state.toolHistory.length > state.config.loop_prevention.max_consecutive) {
        state.toolHistory.shift();
      }
      if (state.toolHistory.length === state.config.loop_prevention.max_consecutive) {
        const allSame = state.toolHistory.every(h => h === callHash);
        if (allSame) {
          throw new Error(`[Watchdog] 🛑 CIRCUIT BREAKER: INFINITE LOOP DETECTED. You have called this exact tool (${input.tool}) ${state.config.loop_prevention.max_consecutive} times in a row without progress. You MUST use the /stop-continuation tool or ask the human for help.`);
        }
      }
    }

    try {
      const verdict = await state.pipeline.evaluate({
        tool_name: input.tool,
        args: (output.args ?? {}) as Record<string, unknown>,
        session_id: input.sessionID,
        call_id: input.callID,
      });

      if (verdict.action === "deny") {
        throw new Error(`[Watchdog] Blocked (confidence: ${verdict.confidence}): ${verdict.reasoning}`);
      }

      if (verdict.action === "ask") {
        state.pendingReviews.set(input.callID, verdict);
        throw new Error(`[Watchdog] Review required (confidence: ${verdict.confidence}): ${verdict.reasoning}. Add tool to allowlist to override.`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("[Watchdog]")) {
        throw error;
      }
      console.warn(error);
    }
  };
};
