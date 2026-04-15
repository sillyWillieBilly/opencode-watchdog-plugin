import { describe, expect, it } from "bun:test";
import { truncateContext } from "@/utils/fifo-budget";

describe("truncateContext", () => {
  it("keeps the system message and most recent messages within budget", () => {
    const messages = [
      { role: "system", content: "system" },
      { role: "user", content: "old".repeat(20) },
      { role: "user", content: "recent" },
    ] as const;
    const result = truncateContext([...messages], 10);
    expect(result[0]?.role).toBe("system");
    expect(result.at(-1)?.content).toBe("recent");
  });
});
