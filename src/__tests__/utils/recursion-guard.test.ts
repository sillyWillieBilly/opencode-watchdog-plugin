import { describe, expect, it } from "bun:test";
import { RecursionGuard } from "@/utils/recursion-guard";

describe("RecursionGuard", () => {
  it("prevents re-entry until cleared", () => {
    const guard = new RecursionGuard();
    guard.markEvaluating("call-1");
    expect(guard.isEvaluating("call-1")).toBe(true);
    guard.clearEvaluating("call-1");
    expect(guard.isEvaluating("call-1")).toBe(false);
  });
});
