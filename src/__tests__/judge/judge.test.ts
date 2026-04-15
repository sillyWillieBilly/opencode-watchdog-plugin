import { describe, expect, it } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DEFAULT_CONFIG } from "@/config";
import { evaluateLLM } from "@/judge";

describe("evaluateLLM", () => {
  it("parses a clean LLM response into a verdict", async () => {
    const provider = {
      name: "mock",
      evaluate: async () => JSON.stringify({ action: "allow", confidence: 0.2, risk_level: "low", reasoning: "safe", concerns: [], suggestions: [], tier: "llm", latency_ms: 0 }),
    };
    const verdict = await evaluateLLM({ tool_name: "bash", args: { command: "ls" }, session_id: "s", call_id: "c" }, provider, DEFAULT_CONFIG);
    expect(verdict.action).toBe("allow");
    expect(verdict.tier).toBe("llm");
  });

  it("falls back on malformed responses", async () => {
    const provider = { name: "mock", evaluate: async () => "nonsense" };
    const verdict = await evaluateLLM({ tool_name: "bash", args: {}, session_id: "s", call_id: "c" }, provider, DEFAULT_CONFIG);
    expect(verdict.action).toBe("allow");
  });

  it("uses custom prompts when present", async () => {
    const dir = await mkdtemp(join(tmpdir(), "watchdog-judge-"));
    try {
      await mkdir(join(dir, ".watchdog"), { recursive: true });
      await writeFile(join(dir, ".watchdog", "system.txt"), "Custom system for {{tool_name}}");
      await writeFile(join(dir, ".watchdog", "user.txt"), "Custom user {{tool_args}}");
      let receivedSystem = "";
      let receivedUser = "";
      const provider = {
        name: "mock",
        evaluate: async (systemPrompt: string, userPrompt: string) => {
          receivedSystem = systemPrompt;
          receivedUser = userPrompt;
          return JSON.stringify({ action: "allow", confidence: 0.2, risk_level: "low", reasoning: "safe", concerns: [], suggestions: [], tier: "llm", latency_ms: 0 });
        },
      };
      await evaluateLLM({ tool_name: "bash", args: { command: "ls" }, session_id: "s", call_id: "c" }, provider, DEFAULT_CONFIG, dir);
      expect(receivedSystem).toContain("Custom system");
      expect(receivedUser).toContain("Custom user");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
