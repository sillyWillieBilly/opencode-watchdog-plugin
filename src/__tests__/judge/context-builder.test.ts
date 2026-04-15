import { describe, expect, it } from "bun:test";
import { buildJudgeContext } from "@/judge/context-builder";

describe("buildJudgeContext", () => {
  it("keeps the system message within the budgeted context", () => {
    const messages = buildJudgeContext({ tool_name: "bash", args: { command: "ls" }, session_id: "session", call_id: "call" }, 5);
    expect(messages[0]?.role).toBe("system");
  });
});
