import type { Hooks } from "@opencode-ai/plugin";
import type { SharedState } from "@/hooks/shared-state";

export const createEventHook = (state: SharedState): NonNullable<Hooks["event"]> => {
  return async ({ event }) => {
    if (event.type === "session.idle") {
      state.toolHistory.length = 0;
      return;
    }

    if (event.type === "session.status" && event.properties.status.type === "idle") {
      state.toolHistory.length = 0;
    }
  };
};
