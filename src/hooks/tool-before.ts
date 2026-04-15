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

    try {
      const verdict = await state.pipeline.evaluate({
        tool_name: input.tool,
        args: (output.args ?? {}) as Record<string, unknown>,
        session_id: input.sessionID,
        call_id: input.callID,
      });

      if (verdict.action === "deny") {
        const concerns = verdict.concerns.length > 0 ? ` Matched: ${verdict.concerns.join(", ")}` : "";
        const suggestions = verdict.suggestions.length > 0 ? ` Suggestions: ${verdict.suggestions.join("; ")}` : "";
        throw new Error(`[Watchdog] 🛑 BLOCKED — Tool "${input.tool}" was denied (risk: ${verdict.risk_level}, confidence: ${verdict.confidence}, tier: ${verdict.tier}).${concerns} Reason: ${verdict.reasoning}.${suggestions}`);
      }

      if (verdict.action === "ask") {
        state.pendingReviews.set(input.callID, verdict);
        const concerns = verdict.concerns.length > 0 ? ` Matched: ${verdict.concerns.join(", ")}` : "";
        throw new Error(`[Watchdog] ⚠️ REVIEW REQUIRED — Tool "${input.tool}" flagged (risk: ${verdict.risk_level}, confidence: ${verdict.confidence}, tier: ${verdict.tier}).${concerns} Reason: ${verdict.reasoning}. Add this tool to your allowlist in .watchdog/config.json if you want to allow it unconditionally.`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("[Watchdog]")) {
        throw error;
      }
      console.warn(error);
    }
  };
};
