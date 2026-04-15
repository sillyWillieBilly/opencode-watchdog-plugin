import { describe, expect, it } from "bun:test";
import { DEFAULT_CONFIG } from "@/config";
import { AuditLogger } from "@/audit/logger";
import { ArbitrationEngine } from "@/judge/arbitration";
import { EvaluationPipeline } from "@/judge/pipeline";
import type { AuditEntry } from "@/types";

describe("ArbitrationEngine", () => {
  it("short-circuits hard deny", () => {
    const engine = new ArbitrationEngine({ thresholds: DEFAULT_CONFIG.thresholds, on_error: "allow" });
    const verdict = engine.arbitrate({ action: "deny", hard: true, matched_rules: ["rule"], reasoning: "blocked" }, { risk_score: 0.1, reasoning: "safe", concerns: [], suggestions: [] });
    expect(verdict.action).toBe("deny");
    expect(verdict.confidence).toBe(1);
  });

  it("routes medium confidence to ask", () => {
    const engine = new ArbitrationEngine({ thresholds: { deny_above: 0.85, review_between: [0.3, 0.85], allow_below: 0.3 }, on_error: "allow" });
    const verdict = engine.arbitrate({ action: "none", hard: false, matched_rules: [], reasoning: "none" }, { risk_score: 0.55, reasoning: "uncertain", concerns: [], suggestions: [] });
    expect(verdict.action).toBe("ask");
  });

  it("logs heuristic verdicts through the pipeline", async () => {
    const logs: string[] = [];
    class TestAuditLogger extends AuditLogger {
      override async log(_entry: AuditEntry): Promise<void> {
        logs.push("logged");
      }
    }

    const logger = new TestAuditLogger(DEFAULT_CONFIG.audit, "test-session");
    const pipeline = new EvaluationPipeline(null, { ...DEFAULT_CONFIG, allowlist: [] }, new ArbitrationEngine({ thresholds: DEFAULT_CONFIG.thresholds, on_error: "allow" }), logger);
    const verdict = await pipeline.evaluate({ tool_name: "bash", args: { command: "rm -rf /" }, session_id: "s", call_id: "c" });
    expect(verdict.action).toBe("deny");
    expect(logs.length).toBe(1);
  });
});
