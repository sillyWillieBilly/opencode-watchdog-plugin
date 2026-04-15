import { describe, expect, it } from "bun:test";
import { parseJudgeResponse } from "@/utils/json-parser";

const verdict = JSON.stringify({ action: "allow", confidence: 0.1, risk_level: "low", reasoning: "safe", concerns: [], suggestions: [], tier: "llm", latency_ms: 0 });

describe("parseJudgeResponse", () => {
  it("parses direct JSON", () => {
    expect(parseJudgeResponse(verdict).action).toBe("allow");
  });

  it("parses markdown wrapped JSON", () => {
    expect(parseJudgeResponse(`\`\`\`json\n${verdict}\n\`\`\``.replace(/\\`/g, "`"))).toMatchObject({ action: "allow" });
  });

  it("parses JSON embedded in prose", () => {
    expect(parseJudgeResponse(`Here is the result ${verdict} thanks`)).toMatchObject({ action: "allow" });
  });

  it("throws for malformed content", () => {
    expect(() => parseJudgeResponse("nonsense")).toThrow("Unable to parse judge response");
  });
});
