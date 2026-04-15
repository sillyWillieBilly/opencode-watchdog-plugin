import { describe, expect, it, mock } from "bun:test";
import { CopilotProvider } from "@/providers/copilot";

describe("CopilotProvider", () => {
  it("creates a session and prompts with the configured model", async () => {
    const create = mock(async () => ({ data: { id: "session-1" } }));
    const prompt = mock(async () => ({ data: { info: {}, parts: [{ type: "text", text: "ok" }] } }));
    const provider = new CopilotProvider({ client: { session: { create, prompt } } } as never, { type: "copilot", model: "github-copilot/gpt-5-mini" }, 1000);
    await expect(provider.evaluate("system", "user")).resolves.toBe("ok");
    expect(create).toHaveBeenCalled();
    expect(prompt).toHaveBeenCalled();
  });

  it("exposes the copilot provider name", () => {
    const provider = new CopilotProvider({ client: { session: { create: async () => ({ data: { id: "x" } }), prompt: async () => ({ data: { info: {}, parts: [{ type: "text", text: "ok" }] } }) } } } as never, { type: "copilot", model: "github-copilot/gpt-5-mini" }, 1000);
    expect(provider.name).toBe("copilot");
  });
});
