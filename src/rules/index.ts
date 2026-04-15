import type { ToolCallContext, WatchdogConfig, WatchdogVerdict } from "@/types";
import { BUILTIN_PATTERNS, matchesPattern } from "@/rules/patterns";
import { isAllowlisted } from "@/rules/allowlist";

const stringifyArgs = (args: Record<string, unknown>): string => JSON.stringify(args);

const riskConfidence: Record<WatchdogVerdict["risk_level"], number> = {
  low: 0.2,
  medium: 0.55,
  high: 0.9,
  critical: 1,
};

export const evaluateHeuristic = (
  context: ToolCallContext,
  config: WatchdogConfig,
): WatchdogVerdict | null => {
  if (isAllowlisted(context.tool_name, config)) {
    return null;
  }

  const haystack = `${context.tool_name} ${stringifyArgs(context.args)}`;
  const patterns = [...BUILTIN_PATTERNS, ...config.blocklist_patterns];
  const matched = patterns.find((pattern) => matchesPattern(haystack, pattern));
  if (!matched) {
    return null;
  }

  return {
    action: "deny",
    confidence: riskConfidence[matched.risk_level],
    risk_level: matched.risk_level,
    reasoning: matched.description,
    concerns: [matched.description],
    suggestions: ["Review the command and narrow its scope before retrying."],
    tier: "heuristic",
    latency_ms: 0,
  };
};
