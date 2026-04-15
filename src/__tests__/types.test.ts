import { describe, expect, it } from "bun:test";
import { isWatchdogConfig, isWatchdogVerdict } from "@/types";

describe("types", () => {
  it("accepts a valid verdict shape", () => {
    expect(
      isWatchdogVerdict({
        action: "allow",
        confidence: 0.9,
        risk_level: "low",
        reasoning: "safe",
        concerns: [],
        suggestions: [],
        tier: "heuristic",
        latency_ms: 0,
      }),
    ).toBe(true);
  });

  it("rejects invalid verdict shape", () => {
    expect(isWatchdogVerdict({ action: "invalid", confidence: -1 })).toBe(false);
  });

  it("accepts valid config shape", () => {
    expect(
      isWatchdogConfig({
        enabled: true,
        thresholds: { deny_above: 0.8, review_between: [0.4, 0.8], allow_below: 0.4 },
        allowlist: ["read"],
        blocklist_patterns: [],
        on_error: "allow",
        timeout_ms: 1000,
        subagent_strategy: "task-wrapper",
        loop_prevention: { enabled: true, max_consecutive: 4 },
        audit: { enabled: true, log_dir: ".watchdog/logs", log_allowed: false, log_denied: true },
        prompts: {},
      }),
    ).toBe(true);
  });

  it("rejects empty config shape", () => {
    expect(isWatchdogConfig({})).toBe(false);
  });
});
