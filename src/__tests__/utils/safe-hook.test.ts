import { describe, expect, it, mock } from "bun:test";
import { safeHook } from "@/utils/safe-hook";

describe("safeHook", () => {
  it("returns fallback when wrapped function throws", async () => {
    const wrapped = safeHook(async () => {
      throw new Error("boom");
    }, { fallback: "fallback" });
    await expect(wrapped()).resolves.toBe("fallback");
  });

  it("passes through successful result", async () => {
    const wrapped = safeHook(async () => "ok");
    await expect(wrapped()).resolves.toBe("ok");
  });

  it("calls onError with the normalized error", async () => {
    const onError = mock(() => undefined);
    const wrapped = safeHook(async () => {
      throw new Error("boom");
    }, { onError });
    await wrapped();
    expect(onError).toHaveBeenCalled();
  });
});
