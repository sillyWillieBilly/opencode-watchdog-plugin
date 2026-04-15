import type { Hooks, Plugin, PluginModule } from "@opencode-ai/plugin";
import { createAuditLogger } from "@/audit";
import { loadConfig } from "@/config";
import { SharedState } from "@/hooks/shared-state";
import { createPermissionAskHook } from "@/hooks/permission-ask";
import { createToolAfterHook } from "@/hooks/tool-after";
import { createToolBeforeHook } from "@/hooks/tool-before";
import { ArbitrationEngine } from "@/judge/arbitration";
import { EvaluationPipeline } from "@/judge/pipeline";
import { createProvider } from "@/providers";
import { SubagentInterceptor } from "@/subagent";

export let watchdogTask: ReturnType<SubagentInterceptor["getTaskWrapper"]> = null;

export const createWatchdogConfig = loadConfig;

const server: Plugin = async (pluginInput) => {
  try {
    const config = await loadConfig(pluginInput.directory);
    const state = new SharedState();
    state.config = config;
    const logger = createAuditLogger(config, "watchdog-session");
    state.auditLogger = logger;
    const provider = config.provider ? createProvider(config.provider, pluginInput, config.timeout_ms) : null;
    const arbitration = new ArbitrationEngine({ thresholds: config.thresholds, on_error: config.on_error });
    const pipeline = new EvaluationPipeline(provider, config, arbitration, logger, pluginInput.directory);
    pipeline.setRecursionGuard(state.recursionGuard);
    state.pipeline = pipeline;

    const subagent = new SubagentInterceptor({ strategy: config.subagent_strategy === "tool-definition" ? "tool-definition" : "task-wrapper", enabled: true }, state, pluginInput.client);
    subagent.initialize();
    watchdogTask = subagent.getTaskWrapper();

    const hooks: Hooks = {
      "tool.execute.before": createToolBeforeHook(state),
      "tool.execute.after": createToolAfterHook(state),
      "permission.ask": createPermissionAskHook(state),
    };

    if (config.subagent_strategy === "tool-definition") {
      hooks["tool.definition"] = subagent.getToolDefinitionHook();
    }

    return hooks;
  } catch (error) {
    console.error("Watchdog initialization failed", error);
    return {};
  }
};

export default { id: "opencode-watchdog-plugin", server } satisfies PluginModule;
