import { evaluateHeuristic } from "@/rules";
import { ArbitrationEngine } from "@/judge/arbitration";
import type { AuditLogger } from "@/audit/logger";
import { evaluateLLM } from "@/judge";
import { RecursionGuard } from "@/utils/recursion-guard";
import type { LLMProvider, ToolCallContext, WatchdogConfig, WatchdogVerdict } from "@/types";

const llmDisabledVerdict = (): WatchdogVerdict => ({
  action: "allow",
  confidence: 0,
  risk_level: "low",
  reasoning: "LLM judge disabled — using heuristics only",
  concerns: [],
  suggestions: [],
  tier: "llm",
  latency_ms: 0,
});

export class EvaluationPipeline {
  private recursionGuard: RecursionGuard | null = null;

  constructor(
    private readonly provider: LLMProvider | null,
    private readonly config: WatchdogConfig,
    private readonly arbitration: ArbitrationEngine,
    private readonly auditLogger: AuditLogger | null,
    private readonly projectDir = process.cwd(),
  ) {}

  setRecursionGuard(guard: RecursionGuard): void {
    this.recursionGuard = guard;
  }

  async evaluate(toolCall: ToolCallContext): Promise<WatchdogVerdict> {
    if (this.recursionGuard?.isEvaluating(toolCall.call_id)) {
      return {
        action: "allow",
        confidence: 1,
        risk_level: "low",
        reasoning: "Skipped due to recursion guard",
        concerns: [],
        suggestions: [],
        tier: "arbitrated",
        latency_ms: 0,
      };
    }

    this.recursionGuard?.markEvaluating(toolCall.call_id);

    try {
      const heuristicVerdict = evaluateHeuristic(toolCall, this.config);
      if (heuristicVerdict) {
        await this.auditLogger?.log({
          timestamp: new Date().toISOString(),
          session_id: toolCall.session_id,
          call_id: toolCall.call_id,
          tool_name: toolCall.tool_name,
          args: toolCall.args,
          verdict: heuristicVerdict,
          latency_ms: heuristicVerdict.latency_ms,
        });
        return heuristicVerdict;
      }

      const llmVerdict = this.provider
        ? await evaluateLLM(toolCall, this.provider, this.config, this.projectDir)
        : llmDisabledVerdict();

      const finalVerdict = this.provider
        ? this.arbitration.arbitrate(
            { action: "none", hard: false, matched_rules: [], reasoning: "No heuristic rule matched" },
            {
              risk_score: llmVerdict.confidence,
              reasoning: llmVerdict.reasoning,
              concerns: llmVerdict.concerns,
              suggestions: llmVerdict.suggestions,
            },
          )
        : llmVerdict;

      await this.auditLogger?.log({
        timestamp: new Date().toISOString(),
        session_id: toolCall.session_id,
        call_id: toolCall.call_id,
        tool_name: toolCall.tool_name,
        args: toolCall.args,
        verdict: finalVerdict,
        latency_ms: finalVerdict.latency_ms,
      });
      return finalVerdict;
    } finally {
      this.recursionGuard?.clearEvaluating(toolCall.call_id);
    }
  }
}
