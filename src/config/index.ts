import { access, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { DEFAULT_CONFIG } from "@/config/defaults";
import { deepMerge } from "@/config/merge";
import { isWatchdogConfig, type ProviderConfig, type ThresholdConfig, type WatchdogConfig } from "@/types";

const PROJECT_CONFIG_PATH = [".watchdog", "config.json"];
const getGlobalConfigPath = (): string => join(process.env.HOME ?? homedir(), ".config", "opencode-watchdog", "config.json");

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const readJson = async (filePath: string): Promise<unknown> => JSON.parse(await readFile(filePath, "utf8"));

const sanitizeProjectConfig = (value: unknown): Partial<WatchdogConfig> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  const projectConfig = { ...(value as Record<string, unknown>) };
  delete projectConfig.provider;
  delete projectConfig.loop_prevention;

  const audit = projectConfig.audit;
  if (typeof audit === "object" && audit !== null && !Array.isArray(audit)) {
    const safeAudit = { ...(audit as Record<string, unknown>) };
    delete safeAudit.log_dir;
    projectConfig.audit = safeAudit;
  }

  return projectConfig as Partial<WatchdogConfig>;
};

const validateThresholds = (thresholds: ThresholdConfig): void => {
  const values = [thresholds.deny_above, thresholds.allow_below, ...thresholds.review_between];
  if (values.some((value) => value < 0 || value > 1)) {
    throw new Error("Watchdog config thresholds must stay within 0-1 range");
  }
  if (thresholds.deny_above <= thresholds.allow_below) {
    throw new Error("Watchdog config thresholds are invalid: deny_above must be greater than allow_below");
  }
  if (
    thresholds.review_between[0] !== thresholds.allow_below ||
    thresholds.review_between[1] !== thresholds.deny_above
  ) {
    throw new Error("Watchdog config review_between must span allow_below to deny_above");
  }
};

const validateProvider = (provider: ProviderConfig): void => {
  if (provider.type === "copilot") {
    if (!provider.model.includes("/")) {
      throw new Error("Copilot provider model must include provider/model format");
    }
    return;
  }

  if (!provider.base_url) {
    throw new Error("OpenAI-compatible provider requires base_url");
  }
  if (!provider.api_key_env) {
    throw new Error("OpenAI-compatible provider requires api_key_env");
  }
};

export const validateConfig = (config: WatchdogConfig): WatchdogConfig => {
  validateThresholds(config.thresholds);
  if (config.provider) {
    validateProvider(config.provider);
  } else {
    console.info("LLM judge disabled — using heuristics only");
  }
  return config;
};

export const loadConfig = async (projectDir: string): Promise<WatchdogConfig> => {
  const projectPath = join(projectDir, ...PROJECT_CONFIG_PATH);
  const globalPath = getGlobalConfigPath();

  const globalConfig = (await fileExists(globalPath)) ? await readJson(globalPath) : undefined;
  const projectConfig = (await fileExists(projectPath)) ? sanitizeProjectConfig(await readJson(projectPath)) : undefined;

  const merged = deepMerge(
    deepMerge(DEFAULT_CONFIG, (globalConfig ?? {}) as Partial<WatchdogConfig>),
    (projectConfig ?? {}) as Partial<WatchdogConfig>,
  );

  if (!isWatchdogConfig(merged)) {
    throw new Error("Invalid watchdog config shape");
  }

  return validateConfig(merged);
};

export { DEFAULT_CONFIG };
