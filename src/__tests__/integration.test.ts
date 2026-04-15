import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { PluginInput } from "@opencode-ai/plugin";
import type { SessionCreateResponse, SessionPromptResponse } from "@opencode-ai/sdk";
import plugin, { watchdogTask } from "@/index";

type SessionClientMethods = Pick<PluginInput["client"]["session"], "create" | "prompt">;

class TestPluginInput implements PluginInput {
  readonly client: PluginInput["client"];
  readonly directory: string;
  readonly worktree: string;
  readonly project: PluginInput["project"];
  readonly serverUrl = new URL("http://localhost");
  readonly $ = {} as PluginInput["$"];

  constructor(directory: string, session: SessionClientMethods) {
    this.client = { session: session as PluginInput["client"]["session"] } as PluginInput["client"];
    this.directory = directory;
    this.worktree = directory;
    this.project = {} as PluginInput["project"];
  }
}

const createSessionClient = (): SessionClientMethods => ({
  create: async () => ({
    data: { id: "judge" } as SessionCreateResponse,
    error: undefined,
    request: new Request("http://localhost/session"),
    response: new Response(),
  }),
  prompt: async () => ({
    data: {
      info: {} as SessionPromptResponse["info"],
      parts: [
        {
          type: "text",
          text: JSON.stringify({ action: "allow", confidence: 0.1, risk_level: "low", reasoning: "ok", concerns: [], suggestions: [], tier: "llm", latency_ms: 0 }),
        },
      ],
    } as SessionPromptResponse,
    error: undefined,
    request: new Request("http://localhost/session/judge/message"),
    response: new Response(),
  }),
});

const dirs: string[] = [];

afterEach(async () => {
  while (dirs.length > 0) {
    const dir = dirs.pop();
    if (dir) await rm(dir, { recursive: true, force: true });
  }
});

describe("plugin integration", () => {
  it("returns a hooks object with expected keys", async () => {
    const dir = await mkdtemp(join(tmpdir(), "watchdog-plugin-"));
    dirs.push(dir);
    const hooks = await plugin.server(new TestPluginInput(dir, createSessionClient()));
    expect(typeof hooks["tool.execute.before"]).toBe("function");
    expect(typeof hooks["tool.execute.after"]).toBe("function");
    expect(typeof hooks["permission.ask"]).toBe("function");
  });

  it("returns empty hooks if initialization fails", async () => {
    const dir = await mkdtemp(join(tmpdir(), "watchdog-invalid-plugin-"));
    dirs.push(dir);
    await mkdir(join(dir, ".watchdog"), { recursive: true });
    await writeFile(join(dir, ".watchdog", "config.json"), "{ invalid json");
    const errors: string[] = [];
    const originalError = console.error;
    console.error = ((message?: unknown, error?: unknown) => {
      errors.push([message, error].filter((value) => value !== undefined).map(String).join(" "));
    }) as typeof console.error;

    try {
      const hooks = await plugin.server(new TestPluginInput(dir, createSessionClient()));
      expect(hooks).toEqual({});
      expect(errors.some((message) => message.includes("Watchdog initialization failed"))).toBe(true);
    } finally {
      console.error = originalError;
    }
  });

  it("exports watchdogTask binding", () => {
    expect(watchdogTask).toBeDefined();
  });
});
