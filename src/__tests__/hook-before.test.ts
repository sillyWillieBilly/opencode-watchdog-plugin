import { describe, expect, it } from "bun:test";
import { SharedState } from "@/hooks/shared-state";
import { createToolBeforeHook } from "@/hooks/tool-before";
import { DEFAULT_CONFIG } from "@/config";

describe("tool.execute.before hook", () => {
  it("throws on deny verdicts", async () => {
    const state = new SharedState();
    state.config = { ...DEFAULT_CONFIG, allowlist: [] };
    state.pipeline = { evaluate: async () => ({ action: "deny", confidence: 0.95, risk_level: "critical", reasoning: "dangerous", concerns: [], suggestions: [], tier: "arbitrated", latency_ms: 0 }) } as never;
    const hook = createToolBeforeHook(state);
    await expect(hook({ tool: "bash", sessionID: "s", callID: "c" }, { args: { command: "rm -rf /" } })).rejects.toThrow("[Watchdog] 🛑 BLOCKED");
  });

  it("stores ask verdicts in pendingReviews", async () => {
    const state = new SharedState();
    state.config = { ...DEFAULT_CONFIG, allowlist: [] };
    state.pipeline = { evaluate: async () => ({ action: "ask", confidence: 0.55, risk_level: "medium", reasoning: "uncertain", concerns: [], suggestions: [], tier: "arbitrated", latency_ms: 0 }) } as never;
    const hook = createToolBeforeHook(state);
    await expect(hook({ tool: "bash", sessionID: "s", callID: "c" }, { args: { command: "touch file" } })).rejects.toThrow("⚠️ REVIEW REQUIRED");
    expect(state.pendingReviews.has("c")).toBe(true);
  });

  it("skips allowlisted tools", async () => {
    const state = new SharedState();
    state.config = DEFAULT_CONFIG;
    let called = false;
    state.pipeline = { evaluate: async () => { called = true; throw new Error("should not run"); } } as never;
    const hook = createToolBeforeHook(state);
    await hook({ tool: "read", sessionID: "s", callID: "c" }, { args: { filePath: "src/index.ts" } });
    expect(called).toBe(false);
  });
});
