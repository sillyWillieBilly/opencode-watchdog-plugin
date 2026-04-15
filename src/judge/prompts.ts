import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildJudgeContext } from "@/judge/context-builder";
import type { PromptConfig, ToolCallContext, WatchdogConfig } from "@/types";

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

export const buildSystemPrompt = (_config: WatchdogConfig): string => `You are a security watchdog evaluating tool calls in an AI coding assistant.
Return only JSON matching this schema: {"action":"allow|deny|ask","confidence":0-1,"risk_level":"low|medium|high|critical","reasoning":"string","concerns":["string"],"suggestions":["string"],"tier":"llm","judge_model":"string","latency_ms":0}.`;

export const buildUserPrompt = (context: ToolCallContext): string =>
  `Tool: ${context.tool_name}\nArgs: ${JSON.stringify(context.args, null, 2)}\nSession: ${context.session_id}\nCall: ${context.call_id}`;

const applyTemplate = (template: string, context: ToolCallContext, config: WatchdogConfig): string => {
  const contextBlock = buildJudgeContext(context, Math.max(64, Math.floor(config.timeout_ms / 100))).map((message) => `${message.role.toUpperCase()}: ${message.content}`).join("\n");
  return template
    .replaceAll("{{tool_name}}", context.tool_name)
    .replaceAll("{{tool_args}}", JSON.stringify(context.args, null, 2))
    .replaceAll("{{session_id}}", context.session_id)
    .replaceAll("{{call_id}}", context.call_id)
    .replaceAll("{{context}}", contextBlock);
};

export const loadCustomPrompts = async (
  config: WatchdogConfig,
  projectDir: string,
): Promise<{ system?: string; user?: string }> => {
  const promptConfig: PromptConfig = config.prompts;
  const systemPath = promptConfig.system_template_path ? join(projectDir, promptConfig.system_template_path) : join(projectDir, ".watchdog", "system.txt");
  const userPath = promptConfig.user_template_path ? join(projectDir, promptConfig.user_template_path) : join(projectDir, ".watchdog", "user.txt");

  return {
    system: (await exists(systemPath)) ? await readFile(systemPath, "utf8") : undefined,
    user: (await exists(userPath)) ? await readFile(userPath, "utf8") : undefined,
  };
};

export const resolvePrompts = async (
  context: ToolCallContext,
  config: WatchdogConfig,
  projectDir: string,
): Promise<{ systemPrompt: string; userPrompt: string }> => {
  const custom = await loadCustomPrompts(config, projectDir);
  return {
    systemPrompt: custom.system ? applyTemplate(custom.system, context, config) : buildSystemPrompt(config),
    userPrompt: custom.user ? applyTemplate(custom.user, context, config) : buildUserPrompt(context),
  };
};
