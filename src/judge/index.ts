import { resolvePrompts } from "@/judge/prompts";
import { parseJudgeResponse } from "@/utils/json-parser";
import type { LLMProvider, ToolCallContext, WatchdogConfig, WatchdogVerdict } from "@/types";

const fallbackVerdict = (config: WatchdogConfig, reason: string, latencyMs: number): WatchdogVerdict => ({
  action: config.on_error,
  confidence: config.on_error === "deny" ? 1 : 0,
  risk_level: config.on_error === "deny" ? "high" : "low",
  reasoning: reason,
  concerns: [reason],
  suggestions: ["Inspect watchdog provider configuration before retrying."],
  tier: "llm",
  latency_ms: latencyMs,
});

export const evaluateLLM = async (
  context: ToolCallContext,
  provider: LLMProvider,
  config: WatchdogConfig,
  projectDir = process.cwd(),
): Promise<WatchdogVerdict> => {
  const startedAt = Date.now();
  try {
    const { systemPrompt, userPrompt } = await resolvePrompts(context, config, projectDir);
    const raw = await provider.evaluate(systemPrompt, userPrompt, {
      timeout_ms: config.timeout_ms,
    });
    const parsed = parseJudgeResponse(raw);
    return {
      ...parsed,
      tier: "llm",
      latency_ms: Date.now() - startedAt,
    };
  } catch (error) {
    return fallbackVerdict(config, error instanceof Error ? error.message : String(error), Date.now() - startedAt);
  }
};
