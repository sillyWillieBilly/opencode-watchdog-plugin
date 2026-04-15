import { select, input, number, confirm } from "@inquirer/prompts";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const configDir = join(process.cwd(), ".watchdog");
const configFile = join(configDir, "config.json");

async function main() {
  console.log("🐕 Welcome to the OpenCode Watchdog Terminal GUI 🐕\n");

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  let currentConfig: any = {};
  if (existsSync(configFile)) {
    try {
      currentConfig = JSON.parse(readFileSync(configFile, "utf-8"));
      console.log("Loaded existing configuration from .watchdog/config.json\n");
    } catch (e) {
      console.error("Warning: Existing config.json is invalid JSON. Starting fresh.\n");
    }
  }

  const onError = await select({
    message: "What should happen if the watchdog crashes or errors?",
    choices: [
      { name: "Allow the tool call (Fail-open, recommended)", value: "allow" },
      { name: "Deny the tool call (Fail-closed, safer)", value: "deny" },
      { name: "Require manual review (ask)", value: "ask" },
    ],
    default: currentConfig.on_error || "allow"
  });

  console.log("\n⚖️  Risk Thresholds (0.0 to 1.0)");
  const denyAbove = await number({
    message: "Deny threshold (Block calls above this confidence):",
    default: currentConfig.thresholds?.deny_above || 0.8,
    min: 0, max: 1
  });
  
  const allowBelow = await number({
    message: "Allow threshold (Auto-allow calls below this confidence):",
    default: currentConfig.thresholds?.allow_below || 0.2,
    min: 0, max: 1
  });

  console.log("\n🤖 Subagent Handling");
  const subagentStrategy = await select({
    message: "How should subagents be monitored?",
    choices: [
      { name: "None (Skip subagent calls)", value: "none" },
      { name: "Task Wrapper (Intercept tasks early)", value: "task-wrapper" },
      { name: "Tool Definition (Inject warnings into prompts)", value: "tool-definition" }
    ],
    default: currentConfig.subagent_strategy || "tool-definition"
  });

  console.log("\n🧠 LLM Judge Setup (Tier 2)");
  const useLlm = await confirm({
    message: "Do you want to enable the Tier 2 LLM Judge for ambiguous commands? (Costs tokens)",
    default: !!currentConfig.provider
  });

  let provider = currentConfig.provider || undefined;
  if (useLlm) {
    const providerType = await select({
      message: "Select Provider Type:",
      choices: [
        { name: "Copilot / GitHub Models", value: "copilot" },
        { name: "OpenAI Compatible (OpenAI, Anthropic, Local, etc.)", value: "openai-compatible" }
      ],
      default: currentConfig.provider?.type || "openai-compatible"
    });

    const modelId = await input({
      message: "Model ID (e.g., gpt-4o, claude-3-5-sonnet-20240620):",
      default: currentConfig.provider?.model_id || "gpt-4o"
    });

    let baseUrl = currentConfig.provider?.base_url;
    if (providerType === "openai-compatible") {
      baseUrl = await input({
        message: "Base URL (e.g., https://api.openai.com/v1):",
        default: currentConfig.provider?.base_url || "https://api.openai.com/v1"
      });
    }

    const apiKeyEnv = await input({
      message: "Environment Variable containing API Key (e.g., OPENAI_API_KEY):",
      default: currentConfig.provider?.api_key_env || "OPENAI_API_KEY"
    });

    provider = {
      type: providerType,
      model_id: modelId,
      ...(baseUrl ? { base_url: baseUrl } : {}),
      api_key_env: apiKeyEnv
    };
  } else {
    provider = undefined;
  }

  const newConfig = {
    ...currentConfig,
    on_error: onError,
    thresholds: {
      deny_above: denyAbove,
      review_between: [allowBelow, denyAbove],
      allow_below: allowBelow
    },
    subagent_strategy: subagentStrategy,
    ...(provider ? { provider } : {})
  };

  if (!newConfig.allowlist) newConfig.allowlist = ["read", "bash", "grep"];
  if (!newConfig.blocklist_patterns) newConfig.blocklist_patterns = ["rm -rf", "sudo", "chmod 777"];

  writeFileSync(configFile, JSON.stringify(newConfig, null, 2), "utf-8");

  console.log("\n✅ Configuration saved to .watchdog/config.json!");
  console.log("To edit allowlists, blocklists, or custom prompts, you can edit the JSON directly.");
}

main().catch(console.error);