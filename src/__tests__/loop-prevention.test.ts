import { describe, expect, it } from "bun:test";
import { DEFAULT_CONFIG } from "@/config";
import { createEventHook } from "@/hooks/event";
import { SharedState } from "@/hooks/shared-state";
import { createToolBeforeHook } from "@/hooks/tool-before";

const allowVerdict = {
  action: "allow",
  confidence: 0.1,
  risk_level: "low",
  reasoning: "ok",
  concerns: [],
  suggestions: [],
  tier: "heuristic",
  latency_ms: 0,
} as const;

const createState = (overrides?: Partial<typeof DEFAULT_CONFIG>) => {
  const state = new SharedState();
  state.config = {
    ...DEFAULT_CONFIG,
    allowlist: [],
    ...overrides,
  };
  let evaluations = 0;
  state.pipeline = {
    evaluate: async () => {
      evaluations += 1;
      return allowVerdict;
    },
  } as never;
  return {
    state,
    getEvaluations: () => evaluations,
  };
};

describe("loop prevention", () => {
  it("triggers the circuit breaker at the configured threshold", async () => {
    const { state, getEvaluations } = createState({
      loop_prevention: { enabled: true, max_consecutive: 4 },
    });
    const hook = createToolBeforeHook(state);

    await expect(hook({ tool: "bash", sessionID: "s", callID: "c1" }, { args: { command: "pwd" } })).resolves.toBeUndefined();
    await expect(hook({ tool: "bash", sessionID: "s", callID: "c2" }, { args: { command: "pwd" } })).resolves.toBeUndefined();
    await expect(hook({ tool: "bash", sessionID: "s", callID: "c3" }, { args: { command: "pwd" } })).resolves.toBeUndefined();
    await expect(hook({ tool: "bash", sessionID: "s", callID: "c4" }, { args: { command: "pwd" } })).rejects.toThrow("exact tool (bash) 4 times in a row");

    expect(getEvaluations()).toBe(3);
  });

  it("does not trigger when args vary inside the sliding window", async () => {
    const { state, getEvaluations } = createState({
      loop_prevention: { enabled: true, max_consecutive: 3 },
    });
    const hook = createToolBeforeHook(state);

    await expect(hook({ tool: "bash", sessionID: "s", callID: "c1" }, { args: { command: "pwd" } })).resolves.toBeUndefined();
    await expect(hook({ tool: "bash", sessionID: "s", callID: "c2" }, { args: { command: "pwd" } })).resolves.toBeUndefined();
    await expect(hook({ tool: "bash", sessionID: "s", callID: "c3" }, { args: { command: "ls" } })).resolves.toBeUndefined();
    await expect(hook({ tool: "bash", sessionID: "s", callID: "c4" }, { args: { command: "pwd" } })).resolves.toBeUndefined();
    await expect(hook({ tool: "bash", sessionID: "s", callID: "c5" }, { args: { command: "pwd" } })).resolves.toBeUndefined();

    expect(getEvaluations()).toBe(5);
  });

  it("skips loop prevention when disabled", async () => {
    const { state, getEvaluations } = createState({
      loop_prevention: { enabled: false, max_consecutive: 2 },
    });
    const hook = createToolBeforeHook(state);

    await expect(hook({ tool: "bash", sessionID: "s", callID: "c1" }, { args: { command: "pwd" } })).resolves.toBeUndefined();
    await expect(hook({ tool: "bash", sessionID: "s", callID: "c2" }, { args: { command: "pwd" } })).resolves.toBeUndefined();
    await expect(hook({ tool: "bash", sessionID: "s", callID: "c3" }, { args: { command: "pwd" } })).resolves.toBeUndefined();

    expect(state.toolHistory).toHaveLength(0);
    expect(getEvaluations()).toBe(3);
  });

  it("resets loop history when the session is interrupted", async () => {
    const { state, getEvaluations } = createState({
      loop_prevention: { enabled: true, max_consecutive: 3 },
    });
    const beforeHook = createToolBeforeHook(state);
    const eventHook = createEventHook(state);

    await expect(beforeHook({ tool: "bash", sessionID: "s", callID: "c1" }, { args: { command: "pwd" } })).resolves.toBeUndefined();
    await expect(beforeHook({ tool: "bash", sessionID: "s", callID: "c2" }, { args: { command: "pwd" } })).resolves.toBeUndefined();

    await eventHook({ event: { type: "session.idle", properties: { sessionID: "s" } } as never });

    await expect(beforeHook({ tool: "bash", sessionID: "s", callID: "c3" }, { args: { command: "pwd" } })).resolves.toBeUndefined();
    await expect(beforeHook({ tool: "bash", sessionID: "s", callID: "c4" }, { args: { command: "pwd" } })).resolves.toBeUndefined();
    await expect(beforeHook({ tool: "bash", sessionID: "s", callID: "c5" }, { args: { command: "pwd" } })).rejects.toThrow("CIRCUIT BREAKER");

    expect(getEvaluations()).toBe(4);
  });
});
