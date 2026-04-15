import { afterEach, describe, expect, it } from "bun:test";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createAuditLogger } from "@/audit";
import { DEFAULT_CONFIG } from "@/config";

const dirs: string[] = [];

afterEach(async () => {
  while (dirs.length > 0) {
    const dir = dirs.pop();
    if (dir) await rm(dir, { recursive: true, force: true });
  }
});

describe("AuditLogger", () => {
  it("creates the log directory during construction", async () => {
    const dir = await mkdtemp(join(tmpdir(), "watchdog-audit-"));
    dirs.push(dir);
    const logDir = join(dir, "logs");
    const logger = createAuditLogger({ ...DEFAULT_CONFIG, audit: { enabled: true, log_dir: logDir, log_allowed: true, log_denied: true } }, "session-1");
    expect(logger).not.toBeNull();
    await access(logDir);
  });

  it("creates directories and appends JSONL entries", async () => {
    const dir = await mkdtemp(join(tmpdir(), "watchdog-audit-"));
    dirs.push(dir);
    const logger = createAuditLogger({ ...DEFAULT_CONFIG, audit: { enabled: true, log_dir: join(dir, "logs"), log_allowed: true, log_denied: true } }, "session-1");
    await logger?.log({ timestamp: new Date().toISOString(), session_id: "session-1", call_id: "call-1", tool_name: "bash", args: {}, verdict: { action: "allow", confidence: 0, risk_level: "low", reasoning: "ok", concerns: [], suggestions: [], tier: "heuristic", latency_ms: 0 }, latency_ms: 0 });
    const content = await readFile(join(dir, "logs", "session-1.jsonl"), "utf8");
    expect(content.trim().split("\n")).toHaveLength(1);
  });

  it("returns null when audit is disabled", () => {
    expect(createAuditLogger({ ...DEFAULT_CONFIG, audit: { ...DEFAULT_CONFIG.audit, enabled: false } }, "session-1")).toBeNull();
  });
});
