import type { ArbitrationConfig, HeuristicResult, LLMVerdict, WatchdogVerdict } from "@/types";

export class ArbitrationEngine {
  constructor(private readonly config: ArbitrationConfig) {}

  arbitrate(tier1: HeuristicResult, tier2: LLMVerdict): WatchdogVerdict {
    if (tier1.hard && tier1.action === "deny") {
      return {
        action: "deny",
        confidence: 1,
        risk_level: "critical",
        reasoning: tier1.reasoning ?? "Denied by heuristic policy",
        concerns: tier1.matched_rules,
        suggestions: ["Revise the operation before retrying."],
        tier: "arbitrated",
        latency_ms: 0,
      };
    }
    if (tier1.hard && tier1.action === "allow") {
      return {
        action: "allow",
        confidence: 1,
        risk_level: "low",
        reasoning: tier1.reasoning ?? "Allowed by heuristic bypass",
        concerns: [],
        suggestions: [],
        tier: "arbitrated",
        latency_ms: 0,
      };
    }

    const score = tier2.risk_score;
    const action = score >= this.config.thresholds.deny_above ? "deny" : score <= this.config.thresholds.allow_below ? "allow" : "ask";
    const riskLevel: WatchdogVerdict["risk_level"] = score >= 0.85 ? "critical" : score >= 0.6 ? "high" : score >= 0.3 ? "medium" : "low";
    return {
      action,
      confidence: score,
      risk_level: riskLevel,
      reasoning: [tier1.reasoning, tier2.reasoning].filter(Boolean).join(" | "),
      concerns: [...tier1.matched_rules, ...tier2.concerns],
      suggestions: tier2.suggestions,
      tier: "arbitrated",
      latency_ms: 0,
    };
  }
}
