import type { PluginInput } from "@opencode-ai/plugin";
import { CopilotProvider } from "@/providers/copilot";
import { OpenAICompatibleProvider } from "@/providers/openai-compatible";
import type { LLMProvider, ProviderConfig } from "@/types";

export const createProvider = (config: ProviderConfig, pluginInput: PluginInput, timeoutMs: number): LLMProvider => {
  if (config.type === "copilot") {
    return new CopilotProvider(pluginInput, config, timeoutMs);
  }
  if (config.type === "openai-compatible") {
    return new OpenAICompatibleProvider(config, timeoutMs);
  }
  throw new Error(`Unsupported provider type: ${(config as { type?: string }).type ?? "unknown"}`);
};
