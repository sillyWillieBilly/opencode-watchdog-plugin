import type { Hooks } from "@opencode-ai/plugin";
import type { SharedState } from "@/hooks/shared-state";

export const createPermissionAskHook = (state: SharedState): NonNullable<Hooks["permission.ask"]> => {
  return async (input, output) => {
    if (!input.callID) {
      return;
    }
    const verdict = state.pendingReviews.get(input.callID);
    if (!verdict) {
      return;
    }

    output.status = "ask";
    try {
      await state.auditLogger?.log({
        timestamp: new Date().toISOString(),
        session_id: input.sessionID,
        call_id: input.callID,
        tool_name: "permission.ask",
        args: {
          title: input.title,
          metadata: typeof input.metadata === "object" && input.metadata !== null ? input.metadata as Record<string, unknown> : {},
        },
        verdict,
        latency_ms: verdict.latency_ms,
      });
    } catch (error) {
      console.warn("Watchdog permission audit logging failed", error);
    } finally {
      state.pendingReviews.delete(input.callID);
    }
  };
};
