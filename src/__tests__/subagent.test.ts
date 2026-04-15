import { describe, expect, it, mock } from "bun:test";
import { SharedState } from "@/hooks/shared-state";
import { SubagentInterceptor } from "@/subagent";
import { createWatchdogTaskWrapper } from "@/subagent/task-wrapper";
import { DEFAULT_CONFIG } from "@/config";

describe("subagent interception", () => {
  it("blocks denied subtasks before spawning", async () => {
    const state = new SharedState();
    state.config = DEFAULT_CONFIG;
    state.pipeline = { evaluate: async () => ({ action: "deny", confidence: 1, risk_level: "critical", reasoning: "dangerous", concerns: [], suggestions: [], tier: "arbitrated", latency_ms: 0 }) } as never;
    const prompt = mock(async () => ({ data: {} }));
    const wrapper = createWatchdogTaskWrapper(state, { session: { prompt } } as never);
    await expect(wrapper({ prompt: "Delete all user data from production DB", description: "cleanup", agent: "build", sessionID: "ses_123" })).rejects.toThrow("Blocked subtask");
    expect(prompt).not.toHaveBeenCalled();
  });

  it("spawns allowed subtasks through session.prompt", async () => {
    const state = new SharedState();
    state.config = DEFAULT_CONFIG;
    state.pipeline = { evaluate: async () => ({ action: "allow", confidence: 0.1, risk_level: "low", reasoning: "safe", concerns: [], suggestions: [], tier: "arbitrated", latency_ms: 0 }) } as never;
    const prompt = mock(async () => ({ data: {} }));
    const wrapper = createWatchdogTaskWrapper(state, { session: { prompt } } as never);
    await wrapper({ prompt: "List files in src/", description: "explore", agent: "explore", sessionID: "ses_123" });
    expect(prompt).toHaveBeenCalled();
  });

  it("switches between strategies from config", () => {
    const taskInterceptor = new SubagentInterceptor({ strategy: "task-wrapper", enabled: true }, new SharedState(), { session: { prompt: async () => ({}) } } as never);
    expect(taskInterceptor.getStrategy()).toBe("task-wrapper");
    expect(taskInterceptor.getTaskWrapper()).not.toBeNull();
    const definitionInterceptor = new SubagentInterceptor({ strategy: "tool-definition", enabled: true }, new SharedState(), { session: { prompt: async () => ({}) } } as never);
    expect(definitionInterceptor.getTaskWrapper()).toBeNull();
  });

  it("injects tool-definition preamble only for risky non-allowlisted tools", async () => {
    const state = new SharedState();
    state.config = { ...DEFAULT_CONFIG, allowlist: [], blocklist_patterns: [] };
    const interceptor = new SubagentInterceptor({ strategy: "tool-definition", enabled: true }, state, { session: { prompt: async () => ({}) } } as never);
    const hook = interceptor.getToolDefinitionHook();

    const riskyOutput = { description: "Run git push --force on the selected branch.", parameters: {} };
    await hook({ toolID: "bash" } as never, riskyOutput);
    expect(riskyOutput.description).toContain("Before executing destructive operations");

    const safeOutput = { description: "List repository files and print matching names.", parameters: {} };
    await hook({ toolID: "bash" } as never, safeOutput);
    expect(safeOutput.description).not.toContain("Before executing destructive operations");
  });

  it("does not inject tool-definition preamble for allowlisted tools even when description looks risky", async () => {
    const state = new SharedState();
    state.config = DEFAULT_CONFIG;
    const interceptor = new SubagentInterceptor({ strategy: "tool-definition", enabled: true }, state, { session: { prompt: async () => ({}) } } as never);
    const hook = interceptor.getToolDefinitionHook();
    const output = { description: "Run rm -rf / on a target directory.", parameters: {} };

    await hook({ toolID: "read" } as never, output);

    expect(output.description).not.toContain("Before executing destructive operations");
  });

  it("initializes safely when called multiple times", () => {
    const interceptor = new SubagentInterceptor({ strategy: "tool-definition", enabled: true }, new SharedState(), { session: { prompt: async () => ({}) } } as never);
    
    // Should not throw or cause errors when called repeatedly
    interceptor.initialize();
    interceptor.initialize();
  });
});
