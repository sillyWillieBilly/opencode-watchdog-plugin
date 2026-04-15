import { describe, expect, it } from "bun:test";
import { AuditLogger } from "@/audit/logger";
import { SharedState } from "@/hooks/shared-state";
import { createPermissionAskHook } from "@/hooks/permission-ask";
import type { AuditEntry } from "@/types";

class TestAuditLogger extends AuditLogger {
  readonly entries: AuditEntry[] = [];

  override async log(entry: AuditEntry): Promise<void> {
    this.entries.push(entry);
  }
}

describe("permission.ask hook", () => {
  it("sets ask status for matching pending review and writes an audit entry", async () => {
    const state = new SharedState();
    state.pendingReviews.set("call-123", { action: "ask", confidence: 0.55, risk_level: "medium", reasoning: "uncertain file operation", concerns: [], suggestions: [], tier: "arbitrated", latency_ms: 0 });
    const auditLogger = new TestAuditLogger({ enabled: true, log_dir: ".watchdog/logs", log_allowed: true, log_denied: true }, "test-session");
    state.auditLogger = auditLogger;
    const hook = createPermissionAskHook(state);
    const output: { status: "ask" | "deny" | "allow" } = { status: "allow" };

    await hook({ id: "p", type: "tool", sessionID: "s", messageID: "m", callID: "call-123", title: "Allow file write?", metadata: {}, time: { created: Date.now() } }, output);

    expect(output.status).toBe("ask");
    expect(auditLogger.entries).toHaveLength(1);
    expect(auditLogger.entries[0]).toMatchObject({
      session_id: "s",
      call_id: "call-123",
      tool_name: "permission.ask",
      verdict: { action: "ask", reasoning: "uncertain file operation" },
    });
    expect(state.pendingReviews.has("call-123")).toBe(false);
  });

  it("passes through when no call id or pending review exists", async () => {
    const state = new SharedState();
    const hook = createPermissionAskHook(state);
    const output: { status: "ask" | "deny" | "allow" } = { status: "allow" };
    await hook({ id: "p", type: "tool", sessionID: "s", messageID: "m", title: "Allow?", metadata: {}, time: { created: Date.now() } }, output);
    expect(output.status).toBe("allow");
  });
});
