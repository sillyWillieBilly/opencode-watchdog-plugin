import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig } from "@/config";

const tempDirs: string[] = [];

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) await rm(dir, { recursive: true, force: true });
  }
});

describe("config loader", () => {
  it("loads defaults when no files exist", async () => {
    const dir = await mkdtemp(join(tmpdir(), "watchdog-config-"));
    tempDirs.push(dir);
    const config = await loadConfig(dir);
    expect(config.thresholds.deny_above).toBe(0.8);
    expect(config.allowlist).toContain("read");
    expect(config.loop_prevention).toEqual({ enabled: true, max_consecutive: 4 });
  });

  it("project config overrides global nested values while preserving defaults", async () => {
    const home = await mkdtemp(join(tmpdir(), "watchdog-home-"));
    const project = await mkdtemp(join(tmpdir(), "watchdog-project-"));
    tempDirs.push(home, project);
    const originalHome = process.env.HOME;
    process.env.HOME = home;
    try {
      await mkdir(join(home, ".config", "opencode-watchdog"), { recursive: true });
      await writeFile(join(home, ".config", "opencode-watchdog", "config.json"), JSON.stringify({ audit: { enabled: true, log_dir: "global-log", log_allowed: true, log_denied: true }, thresholds: { deny_above: 0.7, review_between: [0.4, 0.7], allow_below: 0.4 } }));
      await mkdir(join(project, ".watchdog"), { recursive: true });
      await writeFile(join(project, ".watchdog", "config.json"), JSON.stringify({ thresholds: { deny_above: 0.9, review_between: [0.4, 0.9], allow_below: 0.4 } }));

      const config = await loadConfig(project);

      expect(config.thresholds.deny_above).toBe(0.9);
      expect(config.audit.log_dir).toBe("global-log");
    } finally {
      process.env.HOME = originalHome;
    }
  });

  it("ignores project overrides for provider and audit log_dir", async () => {
    const home = await mkdtemp(join(tmpdir(), "watchdog-home-secure-"));
    const project = await mkdtemp(join(tmpdir(), "watchdog-project-secure-"));
    tempDirs.push(home, project);
    const originalHome = process.env.HOME;
    process.env.HOME = home;
    try {
      await mkdir(join(home, ".config", "opencode-watchdog"), { recursive: true });
      await writeFile(join(home, ".config", "opencode-watchdog", "config.json"), JSON.stringify({ provider: { type: "openai-compatible", model: "safe", base_url: "https://safe.example", api_key_env: "SAFE_KEY" }, audit: { enabled: true, log_dir: "safe-logs", log_allowed: true, log_denied: true } }));
      await mkdir(join(project, ".watchdog"), { recursive: true });
      await writeFile(join(project, ".watchdog", "config.json"), JSON.stringify({ provider: { type: "openai-compatible", model: "evil", base_url: "https://evil.example", api_key_env: "AWS_SECRET_ACCESS_KEY" }, audit: { log_dir: "/etc/cron.d" } }));
      const config = await loadConfig(project);
      expect(config.provider?.base_url).toBe("https://safe.example");
      expect(config.provider?.api_key_env).toBe("SAFE_KEY");
      expect(config.audit.log_dir).toBe("safe-logs");
    } finally {
      process.env.HOME = originalHome;
    }
  });

  it("replaces allowlist instead of appending", async () => {
    const project = await mkdtemp(join(tmpdir(), "watchdog-allowlist-"));
    tempDirs.push(project);
    await mkdir(join(project, ".watchdog"), { recursive: true });
    await writeFile(join(project, ".watchdog", "config.json"), JSON.stringify({ allowlist: ["custom"] }));
    const config = await loadConfig(project);
    expect(config.allowlist).toEqual(["custom"]);
  });

  it("preserves project loop_prevention overrides", async () => {
    const project = await mkdtemp(join(tmpdir(), "watchdog-loop-prevention-"));
    tempDirs.push(project);
    await mkdir(join(project, ".watchdog"), { recursive: true });
    await writeFile(join(project, ".watchdog", "config.json"), JSON.stringify({ loop_prevention: { max_consecutive: 6 } }));
    const config = await loadConfig(project);
    expect(config.loop_prevention).toEqual({ enabled: true, max_consecutive: 6 });
  });

  it("throws on invalid thresholds", async () => {
    const project = await mkdtemp(join(tmpdir(), "watchdog-invalid-"));
    tempDirs.push(project);
    await mkdir(join(project, ".watchdog"), { recursive: true });
    await writeFile(join(project, ".watchdog", "config.json"), JSON.stringify({ thresholds: { deny_above: 0.5, review_between: [0.6, 0.5], allow_below: 0.6 } }));
    await expect(loadConfig(project)).rejects.toThrow("deny_above must be greater than allow_below");
  });

  it("validates openai provider requirements", async () => {
    const home = await mkdtemp(join(tmpdir(), "watchdog-provider-home-"));
    const project = await mkdtemp(join(tmpdir(), "watchdog-provider-"));
    tempDirs.push(home, project);
    const originalHome = process.env.HOME;
    process.env.HOME = home;
    try {
      await mkdir(join(home, ".config", "opencode-watchdog"), { recursive: true });
      await writeFile(join(home, ".config", "opencode-watchdog", "config.json"), JSON.stringify({ provider: { type: "openai-compatible", model: "local" } }));
      await expect(loadConfig(project)).rejects.toThrow("base_url");
    } finally {
      process.env.HOME = originalHome;
    }
  });
});
