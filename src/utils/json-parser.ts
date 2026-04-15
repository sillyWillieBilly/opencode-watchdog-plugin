import { isWatchdogVerdict, type WatchdogVerdict } from "@/types";

const asVerdict = (candidate: unknown): WatchdogVerdict => {
  if (!isWatchdogVerdict(candidate)) {
    throw new Error("Parsed judge response was not a valid WatchdogVerdict");
  }
  return candidate;
};

const tryDirect = (raw: string): WatchdogVerdict => asVerdict(JSON.parse(raw));

const tryCodeBlock = (raw: string): WatchdogVerdict => {
  const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (!match?.[1]) {
    throw new Error("No markdown JSON code block found");
  }
  return asVerdict(JSON.parse(match[1]));
};

const tryBraceExtraction = (raw: string): WatchdogVerdict => {
  const start = raw.indexOf("{");
  if (start < 0) {
    throw new Error("No JSON object start found");
  }
  let depth = 0;
  for (let index = start; index < raw.length; index += 1) {
    const char = raw[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return asVerdict(JSON.parse(raw.slice(start, index + 1)));
      }
    }
  }
  throw new Error("Could not isolate JSON object from judge response");
};

const tryRegexExtraction = (raw: string): WatchdogVerdict => {
  const getString = (field: string): string => {
    const match = raw.match(new RegExp(`"?${field}"?\\s*:\\s*"([^"]*)"`, "i"));
    if (!match) throw new Error(`Missing field ${field}`);
    return match[1];
  };
  const getNumber = (field: string): number => {
    const match = raw.match(new RegExp(`"?${field}"?\\s*:\\s*([0-9.]+)`, "i"));
    if (!match) throw new Error(`Missing field ${field}`);
    return Number(match[1]);
  };
  const getStringArray = (field: string): string[] => {
    const match = raw.match(new RegExp(`"?${field}"?\\s*:\\s*\[(.*?)\]`, "is"));
    if (!match) return [];
    return Array.from(match[1].matchAll(/"([^"]*)"/g)).map((item) => item[1]);
  };

  return {
    action: getString("action") as WatchdogVerdict["action"],
    confidence: getNumber("confidence"),
    risk_level: getString("risk_level") as WatchdogVerdict["risk_level"],
    reasoning: getString("reasoning"),
    concerns: getStringArray("concerns"),
    suggestions: getStringArray("suggestions"),
    tier: (raw.match(/"tier"\s*:\s*"([^"]+)"/i)?.[1] ?? "llm") as WatchdogVerdict["tier"],
    judge_model: raw.match(/"judge_model"\s*:\s*"([^"]+)"/i)?.[1],
    latency_ms: getNumber("latency_ms"),
  };
};

export const parseJudgeResponse = (raw: string): WatchdogVerdict => {
  const strategies = [tryDirect, tryCodeBlock, tryBraceExtraction, tryRegexExtraction];
  const errors: Error[] = [];

  for (const strategy of strategies) {
    try {
      return strategy(raw);
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }
  }

  throw new Error(`Unable to parse judge response: ${errors.map((error) => error.message).join(" | ")}`);
};
