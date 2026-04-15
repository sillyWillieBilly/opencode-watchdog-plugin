import { afterEach, describe, expect, it } from "bun:test";
import { OpenAICompatibleProvider } from "@/providers/openai-compatible";

afterEach(() => {
  delete process.env.TEST_KEY;
  delete process.env.MISSING_KEY;
});

describe("OpenAICompatibleProvider", () => {
  it("sends the correct request format", async () => {
    process.env.TEST_KEY = "secret";
    const originalFetch = globalThis.fetch;
    const mockFetch: typeof fetch = async (input, init) => {
      void input;
      void init;
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 });
    };
    mockFetch.preconnect = originalFetch.preconnect;
    globalThis.fetch = mockFetch;
    const provider = new OpenAICompatibleProvider({ type: "openai-compatible", model: "local-model", base_url: "http://localhost:11434", api_key_env: "TEST_KEY" }, 1000);
    try {
      await expect(provider.evaluate("system", "user")).resolves.toBe("ok");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("throws when the api key is missing", async () => {
    delete process.env.MISSING_KEY;
    const provider = new OpenAICompatibleProvider({ type: "openai-compatible", model: "local-model", base_url: "http://localhost:11434", api_key_env: "MISSING_KEY" }, 1000);
    await expect(provider.evaluate("system", "user")).rejects.toThrow("Missing API key");
  });
});
