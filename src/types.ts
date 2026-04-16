export type WatchdogAction = "allow" | "deny" | "ask";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type VerdictTier = "heuristic" | "llm" | "arbitrated";
export type OnErrorPolicy = "allow" | "deny";
export type ProviderType = "copilot" | "openai-compatible";
export type PatternType = "glob" | "regex";
export type SubagentStrategy = "task-wrapper" | "tool-definition" | "both";

export interface WatchdogVerdict {
  action: WatchdogAction;
  confidence: number;
  risk_level: RiskLevel;
  reasoning: string;
  concerns: string[];
  suggestions: string[];
  tier: VerdictTier;
  judge_model?: string;
  latency_ms: number;
}

export interface ThresholdConfig {
  deny_above: number;
  review_between: [number, number];
  allow_below: number;
}

export interface ProviderConfig {
  type: ProviderType;
  model: string;
  base_url?: string;
  api_key_env?: string;
}

export interface BlocklistPattern {
  pattern: string;
  type: PatternType;
  risk_level: RiskLevel;
  description: string;
}

export interface AuditConfig {
  enabled: boolean;
  log_dir: string;
  log_allowed: boolean;
  log_denied: boolean;
}

export interface PromptConfig {
  system_template_path?: string;
  user_template_path?: string;
}

export interface LoopPreventionConfig {
  enabled: boolean;
  max_consecutive: number;
}

export interface WatchdogConfig {
  enabled: boolean;
  provider?: ProviderConfig;
  thresholds: ThresholdConfig;
  allowlist: string[];
  blocklist_patterns: BlocklistPattern[];
  on_error: OnErrorPolicy;
  timeout_ms: number;
  subagent_strategy: SubagentStrategy;
  audit: AuditConfig;
  prompts: PromptConfig;
  loop_prevention: LoopPreventionConfig;
}

export interface AuditEntry {
  timestamp: string;
  session_id: string;
  call_id: string;
  tool_name: string;
  args: Record<string, unknown>;
  outcome?: "success" | "failure";
  severity?: "info" | "warning" | "alert";
  duration_ms?: number;
  verdict: WatchdogVerdict;
  latency_ms: number;
}

export interface EvaluateOptions {
  timeout_ms?: number;
  temperature?: number;
  max_tokens?: number;
}

export interface LLMProvider {
  name: string;
  evaluate(systemPrompt: string, userPrompt: string, options?: EvaluateOptions): Promise<string>;
}

export interface ToolCallContext {
  tool_name: string;
  args: Record<string, unknown>;
  session_id: string;
  call_id: string;
}

export interface HeuristicResult {
  action: "allow" | "deny" | "none";
  hard: boolean;
  matched_rules: string[];
  reasoning?: string;
}

export interface LLMVerdict {
  risk_score: number;
  reasoning: string;
  concerns: string[];
  suggestions: string[];
}

export interface ArbitrationConfig {
  thresholds: ThresholdConfig;
  on_error: OnErrorPolicy;
}

export interface ReadOnlyBypassConfig {
  tools: string[];
  patterns?: string[];
}

export interface SuspiciousPattern {
  name: string;
  severity: RiskLevel;
  evidence: string;
  description: string;
}

export interface PostAuditContext {
  tool_name: string;
  args: Record<string, unknown>;
  output: string;
  metadata: unknown;
  session_id: string;
  call_id: string;
}

export interface SubagentConfig {
  strategy: "task-wrapper" | "tool-definition";
  enabled: boolean;
}

export interface JudgeMessage {
  role: "system" | "user";
  content: string;
}

export interface WatchdogTaskOptions {
  prompt: string;
  description: string;
  agent: string;
  sessionID: string;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isThresholdConfig = (value: unknown): value is ThresholdConfig => {
  if (!isObject(value)) return false;
  return (
    typeof value.deny_above === "number" &&
    Array.isArray(value.review_between) &&
    value.review_between.length === 2 &&
    value.review_between.every((item) => typeof item === "number") &&
    typeof value.allow_below === "number"
  );
};

const isAuditConfig = (value: unknown): value is AuditConfig => {
  if (!isObject(value)) return false;
  return (
    typeof value.enabled === "boolean" &&
    typeof value.log_dir === "string" &&
    typeof value.log_allowed === "boolean" &&
    typeof value.log_denied === "boolean"
  );
};

const isPromptConfig = (value: unknown): value is PromptConfig => {
  if (!isObject(value)) return false;
  return (
    (value.system_template_path === undefined || typeof value.system_template_path === "string") &&
    (value.user_template_path === undefined || typeof value.user_template_path === "string")
  );
};

const isProviderConfig = (value: unknown): value is ProviderConfig => {
  if (!isObject(value)) return false;
  return (
    (value.type === "copilot" || value.type === "openai-compatible") &&
    typeof value.model === "string" &&
    (value.base_url === undefined || typeof value.base_url === "string") &&
    (value.api_key_env === undefined || typeof value.api_key_env === "string")
  );
};

const isBlocklistPatternArray = (value: unknown): value is BlocklistPattern[] =>
  Array.isArray(value) &&
  value.every(
    (item) =>
      isObject(item) &&
      typeof item.pattern === "string" &&
      (item.type === "glob" || item.type === "regex") &&
      ["low", "medium", "high", "critical"].includes(String(item.risk_level)) &&
      typeof item.description === "string",
  );

const isLoopPreventionConfig = (value: unknown): value is LoopPreventionConfig => {
  if (!isObject(value)) return false;
  return (
    typeof value.enabled === "boolean" &&
    typeof value.max_consecutive === "number"
  );
};

export const isWatchdogVerdict = (value: unknown): value is WatchdogVerdict => {
  if (!isObject(value)) return false;
  return (
    ["allow", "deny", "ask"].includes(String(value.action)) &&
    typeof value.confidence === "number" &&
    ["low", "medium", "high", "critical"].includes(String(value.risk_level)) &&
    typeof value.reasoning === "string" &&
    isStringArray(value.concerns) &&
    isStringArray(value.suggestions) &&
    ["heuristic", "llm", "arbitrated"].includes(String(value.tier)) &&
    (value.judge_model === undefined || typeof value.judge_model === "string") &&
    typeof value.latency_ms === "number"
  );
};

export const isWatchdogConfig = (value: unknown): value is WatchdogConfig => {
  if (!isObject(value)) return false;
  return (
    typeof value.enabled === "boolean" &&
    (value.provider === undefined || isProviderConfig(value.provider)) &&
    isThresholdConfig(value.thresholds) &&
    isStringArray(value.allowlist) &&
    isBlocklistPatternArray(value.blocklist_patterns) &&
    (value.on_error === "allow" || value.on_error === "deny") &&
    typeof value.timeout_ms === "number" &&
    ["task-wrapper", "tool-definition", "both"].includes(String(value.subagent_strategy)) &&
    isAuditConfig(value.audit) &&
    isPromptConfig(value.prompts) &&
    isLoopPreventionConfig(value.loop_prevention)
  );
};
