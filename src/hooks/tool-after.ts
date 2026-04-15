import type { Hooks } from "@opencode-ai/plugin";
import { OutputAnalyzer } from "@/audit/output-analyzer";
import { safeHook } from "@/utils/safe-hook";
import type { SharedState } from "@/hooks/shared-state";

export const createToolAfterHook = (state: SharedState): NonNullable<Hooks["tool.execute.after"]> => {
  const analyzer = new OutputAnalyzer();
  return safeHook(async (input, output) => {
    if (state.recursionGuard.isEvaluating(input.callID)) {
      return;
    }

    if (!state.auditLogger) {
      return;
    }

    const durationMs = 0;
    const completionOutcome = "success";
    const patterns = analyzer.analyzeOutput(input.tool, input.args, output.output, state.config?.blocklist_patterns ?? []);
    const hasAlert = patterns.some((pattern) => pattern.severity === "high" || pattern.severity === "critical");

    for (const pattern of patterns) {
      const severity = pattern.severity === "high" || pattern.severity === "critical" ? "alert" : "warning";
      await state.auditLogger.log({
        timestamp: new Date().toISOString(),
        session_id: input.sessionID,
        call_id: input.callID,
        tool_name: input.tool,
        args: input.args as Record<string, unknown>,
        outcome: completionOutcome,
        severity,
        duration_ms: durationMs,
        verdict: {
          action: "ask",
          confidence: pattern.severity === "high" || pattern.severity === "critical" ? 0.9 : 0.55,
          risk_level: pattern.severity,
          reasoning: `${severity === "alert" ? "Alert" : "Warning"}: ${pattern.description}`,
          concerns: [pattern.evidence],
          suggestions: ["Inspect the tool output for sensitive or unexpected data."],
          tier: "heuristic",
          latency_ms: durationMs,
        },
        latency_ms: durationMs,
      });
    }

    await state.auditLogger.log({
      timestamp: new Date().toISOString(),
      session_id: input.sessionID,
      call_id: input.callID,
      tool_name: input.tool,
      args: input.args as Record<string, unknown>,
      outcome: completionOutcome,
      severity: hasAlert ? "alert" : patterns.length > 0 ? "warning" : "info",
      duration_ms: durationMs,
      verdict: {
        action: "allow",
        confidence: 1,
        risk_level: hasAlert ? "high" : patterns.length > 0 ? "medium" : "low",
        reasoning: `Completed ${input.tool} with ${completionOutcome} in ${durationMs}ms`,
        concerns: patterns.map((pattern) => `${pattern.name}: ${pattern.evidence}`),
        suggestions: patterns.length > 0 ? ["Review flagged output findings before trusting this tool result."] : [],
        tier: "heuristic",
        latency_ms: durationMs,
      },
      latency_ms: durationMs,
    });
  }, { onError: (error) => console.warn(error) }) as NonNullable<Hooks["tool.execute.after"]>;
};
