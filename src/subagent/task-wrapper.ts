import type { PluginInput } from "@opencode-ai/plugin";
import type { SharedState } from "@/hooks/shared-state";
import type { WatchdogTaskOptions } from "@/types";

export const createWatchdogTaskWrapper = (state: SharedState, client: PluginInput["client"]) => {
  return async (options: WatchdogTaskOptions): Promise<void> => {
    if (!state.pipeline) {
      return;
    }
    const verdict = await state.pipeline.evaluate({
      tool_name: "subtask",
      args: {
        prompt: options.prompt,
        description: options.description,
        agent: options.agent,
      },
      session_id: options.sessionID,
      call_id: `${options.sessionID}:subtask:${options.description}`,
    });
    if (verdict.action === "deny") {
      throw new Error(`[Watchdog] Blocked subtask: ${verdict.reasoning}`);
    }
    if (verdict.action === "ask") {
      throw new Error(`[Watchdog] Review required for subtask: ${verdict.reasoning}`);
    }
    await client.session.prompt({
      path: { id: options.sessionID },
      body: {
        parts: [{ type: "subtask", prompt: options.prompt, description: options.description, agent: options.agent }],
      },
    });
  };
};
