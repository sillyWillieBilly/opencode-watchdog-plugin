import { describe, expect, it } from "bun:test";
import { DEFAULT_CONFIG } from "@/config";
import { SharedState } from "@/hooks/shared-state";
import { createToolAfterHook } from "@/hooks/tool-after";

describe("tool.execute.after hook", () => {
  it("logs suspicious output patterns", async () => {
    const entries: unknown[] = [];
    const state = new SharedState();
    state.config = {
      ...DEFAULT_CONFIG,
      blocklist_patterns: [{ pattern: "viewer", type: "regex", risk_level: "medium", description: "Mutation-sensitive inspection tool" }],
    };
    state.auditLogger = { log: async (entry: unknown) => void entries.push(entry) } as never;
    const hook = createToolAfterHook(state);
    await hook({ tool: "viewer", sessionID: "s", callID: "c", args: {} }, { title: "viewer", output: "AKIAIOSFODNN7EXAMPLE updated", metadata: {} });
    expect(entries.length).toBeGreaterThan(1);
    expect(entries[0]).toMatchObject({ outcome: "success", severity: "alert" });
    expect(entries[0]).not.toMatchObject({ verdict: { concerns: ["AKIAIOSFODNN7EXAMPLE"] } });
    expect(entries.at(-1)).toMatchObject({
      outcome: "success",
      severity: "alert",
      duration_ms: 0,
      verdict: {
        action: "allow",
      },
    });
  });

  it("skips watchdog-recursive calls", async () => {
    const entries: unknown[] = [];
    const state = new SharedState();
    state.auditLogger = { log: async (entry: unknown) => void entries.push(entry) } as never;
    state.recursionGuard.markEvaluating("c");
    const hook = createToolAfterHook(state);
    await hook({ tool: "bash", sessionID: "s", callID: "c", args: {} }, { title: "bash", output: "ok", metadata: {} });
    expect(entries).toHaveLength(0);
  });
});
