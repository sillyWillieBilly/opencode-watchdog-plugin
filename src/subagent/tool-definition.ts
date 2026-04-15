import type { Hooks } from "@opencode-ai/plugin";
import { isAllowlisted } from "@/rules/allowlist";
import { BUILTIN_PATTERNS, matchesPattern } from "@/rules/patterns";
import type { SharedState } from "@/hooks/shared-state";

const PREAMBLE = "IMPORTANT: Before executing destructive operations, describe your intended action and wait for approval.";

const isRiskyToolDefinition = (toolID: string, description: string, state: SharedState): boolean => {
  if (!state.config || isAllowlisted(toolID, state.config)) {
    return false;
  }

  const patterns = [...BUILTIN_PATTERNS, ...state.config.blocklist_patterns].filter((pattern) => pattern.risk_level === "high" || pattern.risk_level === "critical");
  const haystack = `${toolID} ${description}`;
  return patterns.some((pattern) => matchesPattern(haystack, pattern));
};

export const createToolDefinitionHook = (state: SharedState): NonNullable<Hooks["tool.definition"]> => {
  return async (input, output) => {
    if (!isRiskyToolDefinition(input.toolID, output.description, state)) {
      return;
    }
    output.description = `${PREAMBLE}\n\n${output.description}`;
  };
};
