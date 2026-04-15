# 🐕 OpenCode Watchdog Plugin

A safety review layer for [OpenCode](https://opencode.ai) that evaluates tool calls before they execute — blocking dangerous commands, escalating ambiguous ones, and preventing infinite loops that burn tokens.

## Why?

Autonomous coding agents are powerful, but they can cause real damage:
- **Dangerous commands**: `rm -rf /`, `DROP TABLE`, `git push --force` — executed without hesitation
- **Infinite loops**: When an agent gets stuck on a blocked task, it can repeat the same tool call hundreds of times overnight, burning API credits
- **Uncontrolled subagents**: Subagent task calls bypass normal hook interception

Watchdog sits between the agent and every tool call. It evaluates risk in three tiers and takes action before damage occurs.

## How It Works

```
Tool Call → Tier 1 (Heuristics) → Tier 2 (LLM Judge) → Tier 3 (Arbitration) → Decision
              │                      │                       │
              │ Fast pattern         │ Optional LLM          │ Threshold-based
              │ matching             │ risk assessment       │ allow/deny/ask
              ▼                      ▼                       ▼
         Obvious blocks        Ambiguous calls          Final verdict
```

- **Tier 1** — Heuristic rules instantly block obvious dangerous patterns (e.g. `rm -rf /`, `sudo`, SQL injection). Zero latency, zero cost.
- **Tier 2** — When a call is ambiguous, an LLM judge evaluates it. This tier is only active if you configure a provider.
- **Tier 3** — Threshold-based arbitration converts the LLM's risk score into a decision: `allow`, `deny`, or `ask` (require human review).

Additionally, a **Loop Detection Circuit Breaker** prevents infinite tool-call loops — if the same tool call repeats `max_consecutive` times (default: 4), it's blocked immediately, saving tokens and preventing runaway costs.

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) runtime
- An OpenCode installation

### Install

```bash
git clone https://github.com/sillyWillieBilly/opencode-watchdog-plugin.git
cd opencode-watchdog-plugin
bun install
```

### Configure

Copy the example config and adjust it:

```bash
cp .watchdog/config.example.json .watchdog/config.json
```

Or use the interactive terminal setup wizard:

```bash
bun run configure
```

The wizard walks you through error strategy, risk thresholds, subagent handling, and LLM provider setup.

### Register with OpenCode

Add the plugin to your `opencode.json` (usually at `~/.config/opencode/opencode.json`):

```json
{
  "plugin": [
    "file:///path/to/opencode-watchdog-plugin"
  ]
}
```

Restart OpenCode. The plugin loads automatically.

## Choosing an LLM Provider (Tier 2)

Tier 2 (the LLM judge) is **optional**. Without a provider, Watchdog uses Tier 1 heuristics alone — still effective at blocking obvious threats, but it won't evaluate ambiguous calls.

### Free and Low-Cost Options

Before spending money on an LLM provider, check if you already have access to a free option:

| Provider | Cost | Setup |
|----------|------|-------|
| **GitHub Copilot** | Free with GitHub account | Set `"type": "copilot"` and `"model": "github-copilot/gpt-5-mini"` |
| **Groq** | Free tier available | Set `"type": "openai-compatible"`, `"base_url": "https://api.groq.com/openai/v1"`, and `"model": "llama-3.3-70b-versatile"` |
| **Ollama (local)** | Free (runs locally) | Set `"type": "openai-compatible"`, `"base_url": "http://localhost:11434"`, and `"model": "your-local-model"` |
| **OpenAI** | Pay-per-token | Set `"type": "openai-compatible"`, `"base_url": "https://api.openai.com/v1"`, and `"model": "gpt-4o-mini"` |

**Tip:** If you use GitHub Copilot for code completion (free tier), you already have access to models through the Copilot API — no additional cost.

### When You Don't Need Tier 2

If you only care about blocking obviously dangerous commands (`rm -rf`, `sudo`, `DROP TABLE`), Tier 1 heuristics are sufficient. Simply omit the `provider` field from your config. Heuristic evaluation is instant and costs nothing.

## Configuration Reference

All configuration lives in `.watchdog/config.json` (per-project) or your global config. The example files are the best starting point:

| File | Purpose |
|------|---------|
| `.watchdog/config.example.json` | Standard setup with GitHub Copilot |
| `.watchdog/config.power-user.example.json` | Stricter thresholds, logging everything, local LLM routing |

### Full Config Schema

```json
{
  "enabled": true,
  "provider": {
    "type": "copilot | openai-compatible",
    "model": "github-copilot/gpt-5-mini",
    "base_url": "https://api.groq.com/openai/v1",
    "api_key_env": "OPENAI_API_KEY"
  },
  "thresholds": {
    "deny_above": 0.85,
    "review_between": [0.3, 0.85],
    "allow_below": 0.3
  },
  "allowlist": ["read", "grep", "glob", "lsp_symbols"],
  "blocklist_patterns": [
    {
      "pattern": "*rm -rf /*",
      "type": "glob",
      "risk_level": "critical",
      "description": "Recursive delete from root"
    }
  ],
  "on_error": "allow",
  "timeout_ms": 30000,
  "subagent_strategy": "task-wrapper | tool-definition | both",
  "loop_prevention": {
    "enabled": true,
    "max_consecutive": 4
  },
  "audit": {
    "enabled": true,
    "log_dir": ".watchdog/logs",
    "log_allowed": false,
    "log_denied": true
  },
  "prompts": {
    "system_template_path": ".watchdog/prompts/system.txt",
    "user_template_path": ".watchdog/prompts/user.txt"
  }
}
```

### Key Fields Explained

| Field | Default | Description |
|-------|---------|-------------|
| `enabled` | `true` | Master switch. Set `false` to disable all Watchdog checks. |
| `provider` | `null` | LLM provider for Tier 2. Omit to disable Tier 2 (heuristic-only mode). |
| `thresholds.deny_above` | `0.85` | Risk scores above this are always denied. |
| `thresholds.review_between` | `[0.3, 0.85]` | Risk scores in this range are flagged for human review (`ask` action). |
| `thresholds.allow_below` | `0.3` | Risk scores below this are always allowed. |
| `allowlist` | `["read", "grep", ...]` | Tools that bypass evaluation entirely (safe read-only tools). |
| `blocklist_patterns` | `[...]` | Patterns that are instantly denied by Tier 1 heuristics. |
| `on_error` | `"allow"` | What happens if Watchdog itself crashes: `"allow"` (fail-open) or `"deny"` (fail-closed). |
| `loop_prevention.enabled` | `true` | Enable the infinite-loop circuit breaker. |
| `loop_prevention.max_consecutive` | `4` | Number of identical consecutive tool calls before blocking. |
| `subagent_strategy` | `"task-wrapper"` | How subagents are monitored: `"task-wrapper"`, `"tool-definition"`, or `"both"`. |
| `audit.enabled` | `true` | Log all tool call evaluations to JSONL files. |
| `audit.log_allowed` | `false` | Whether to log allowed calls (can be verbose). |
| `audit.log_denied` | `true` | Whether to log denied calls. |

### Custom Prompt Templates

You can customize the LLM judge's system and user prompts:

1. Copy the examples:
   ```bash
   cp .watchdog/prompts/system.example.txt .watchdog/prompts/system.txt
   cp .watchdog/prompts/user.example.txt .watchdog/prompts/user.txt
   ```
2. Edit `.watchdog/system.txt` and `.watchdog/user.txt` to your liking.
3. The templates support `{{tool_name}}`, `{{tool_args}}`, and `{{context}}` placeholders.

### Config Priority

Watchdog loads config in this order (later overrides earlier):

1. Built-in defaults
2. Global config (`~/.config/opencode/.watchdog/config.json`)
3. Project-local config (`.watchdog/config.json` in your project root)

**Security note:** Project-local config cannot override `provider`, `api_key_env`, or `audit.log_dir` — these are locked to your global config to prevent a malicious repo from redirecting API keys or audit logs.

## Loop Prevention

The circuit breaker tracks the last `max_consecutive` tool calls. If every call in that window is identical (same tool name + same arguments), it blocks the call and forces a break in the loop.

This is designed to catch the exact pattern that causes runaway token costs: an agent stuck reading the same plan file over and over because it cannot complete a blocked task.

You can tune the sensitivity:
- **Lower values** (e.g. `3`): Catches loops faster, but may trigger on legitimate retry logic
- **Higher values** (e.g. `6`): More tolerant of retries, but costs more tokens before catching a loop
- **Disable entirely**: Set `"enabled": false`

## Subagent Strategies

OpenCode's subagent calls (`task()`) aren't intercepted by normal hooks. Watchdog provides two strategies:

| Strategy | How It Works | Trade-off |
|----------|-------------|-----------|
| `task-wrapper` | Wraps the subagent task function to evaluate the prompt before execution | Blocks dangerous subtasks before they start, but requires the task to go through Watchdog's wrapper |
| `tool-definition` | Injects a warning preamble into tool definitions for risky tools | Doesn't block execution, but warns the subagent model about risks. Best-effort — depends on model compliance |
| `both` | Uses both strategies simultaneously | Maximum coverage, slight overhead |

## Architecture

```
src/
├── config/          # Config loading, defaults, merging
├── rules/           # Tier 1 heuristic pattern matching
├── providers/       # LLM provider adapters (Copilot, OpenAI-compatible)
├── judge/            # Tier 2 prompt building, verdict parsing, arbitration
├── hooks/            # OpenCode hook integration (tool-before, tool-after, permission-ask)
│   ├── shared-state.ts    # Shared state across hooks (pipeline, config, history)
│   └── tool-before.ts     # Loop detection circuit breaker
├── subagent/         # Subagent interception (task-wrapper, tool-definition)
├── audit/            # JSONL audit logging and output analysis
├── cli/              # Interactive terminal configuration wizard
├── types.ts          # Full TypeScript type definitions
└── index.ts          # Plugin entry point
```

## Terminal Configuration Wizard

Run the interactive setup:

```bash
bun run configure
```

The wizard will guide you through:
1. Error handling strategy (fail-open vs fail-closed)
2. Risk thresholds
3. Subagent monitoring strategy
4. LLM provider setup (with free options highlighted)
5. Allowlist configuration

## Running Tests

```bash
bun test
```

All 64 tests pass. The test suite covers heuristics, pipeline evaluation, arbitration, loop detection, subagent interception, config loading, and audit logging.

## Building

```bash
bun run build
```

Outputs to `dist/index.js` (~50 KB bundled).

## Known Limitations

- Subagent tool calls are not intercepted by default in OpenCode (the `task-wrapper` strategy requires opt-in usage)
- Hook context does not include agent identity
- `ask()` (human review) is not available inside plugin hooks
- Tool definition injection is best-effort and depends on model compliance

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b my-feature`
3. Add heuristic patterns in `src/rules/patterns.ts`, providers in `src/providers/`, or hook behavior in `src/hooks/`
4. Keep changes aligned with the config schema and add tests
5. Open a PR

## License

[MIT](LICENSE) — use it however you want.