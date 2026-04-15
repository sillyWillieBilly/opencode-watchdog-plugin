import { describe, expect, it } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DEFAULT_CONFIG } from "@/config";
import { buildSystemPrompt, buildUserPrompt, loadCustomPrompts, resolvePrompts } from "@/judge/prompts";

describe("judge prompts", () => {
  it("mentions the response schema in the system prompt", () => {
    expect(buildSystemPrompt(DEFAULT_CONFIG)).toContain("Return only JSON matching this schema");
  });

  it("includes tool name and args in the user prompt", () => {
    expect(buildUserPrompt({ tool_name: "bash", args: { command: "ls" }, session_id: "s", call_id: "c" })).toContain("bash");
  });

  it("loads custom prompt overrides when files exist", async () => {
    const dir = await mkdtemp(join(tmpdir(), "watchdog-prompts-"));
    try {
      await mkdir(join(dir, ".watchdog"), { recursive: true });
      await writeFile(join(dir, ".watchdog", "system.txt"), "Custom judge instructions");
      const prompts = await loadCustomPrompts(DEFAULT_CONFIG, dir);
      expect(prompts.system).toBe("Custom judge instructions");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("resolves custom templates with placeholders", async () => {
    const dir = await mkdtemp(join(tmpdir(), "watchdog-resolve-prompts-"));
    try {
      await mkdir(join(dir, ".watchdog"), { recursive: true });
      await writeFile(join(dir, ".watchdog", "system.txt"), "System for {{tool_name}}");
      await writeFile(join(dir, ".watchdog", "user.txt"), "Args: {{tool_args}}\nContext: {{context}}");
      const prompts = await resolvePrompts({ tool_name: "bash", args: { command: "ls" }, session_id: "s", call_id: "c" }, DEFAULT_CONFIG, dir);
      expect(prompts.systemPrompt).toContain("bash");
      expect(prompts.userPrompt).toContain("command");
      expect(prompts.userPrompt).toContain("SYSTEM:");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
