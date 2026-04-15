import type { PluginInput } from "@opencode-ai/plugin";
import { createToolDefinitionHook } from "@/subagent/tool-definition";
import { createWatchdogTaskWrapper } from "@/subagent/task-wrapper";
import type { SharedState } from "@/hooks/shared-state";
import type { SubagentConfig } from "@/types";

export class SubagentInterceptor {
  private readonly strategy: SubagentConfig["strategy"];
  private taskWrapper: ReturnType<typeof createWatchdogTaskWrapper> | null = null;
  private readonly toolDefinitionHook;
  private initialized = false;

  constructor(config: SubagentConfig, state: SharedState, client: PluginInput["client"]) {
    this.strategy = config.strategy;
    this.toolDefinitionHook = createToolDefinitionHook(state);
    if (this.strategy === "task-wrapper") {
      this.taskWrapper = createWatchdogTaskWrapper(state, client);
    }
  }

  initialize(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
  }

  getStrategy(): SubagentConfig["strategy"] {
    return this.strategy;
  }

  getTaskWrapper() {
    return this.taskWrapper;
  }

  getToolDefinitionHook() {
    return this.toolDefinitionHook;
  }
}
