# 🐕 OpenCode Watchdog Plugin

## Overview

OpenCode Watchdog Plugin adds a safety review layer around tool execution. It evaluates tool calls with heuristic rules first, can optionally escalate ambiguous calls to an LLM judge, then applies threshold-based arbitration to allow, deny, or require review.

## Quick Start

```bash
bun install
```

Copy `.watchdog/config.example.json` to `.watchdog/config.json`, adjust the provider if you want Tier 2 enabled, then register the plugin in your `opencode.json` with a `file://` path pointing at this project.

## How It Works

`Heuristic Rules -> LLM Judge -> Arbitration -> Hook Action`

- Tier 1 blocks obvious dangerous patterns quickly.
- Tier 2 asks an LLM for structured risk assessment when a provider is configured.
- Tier 3 converts the risk score into `allow`, `deny`, or `ask` using thresholds.

## Configuration

- Provider setup lives in `.watchdog/config.json`.
- Thresholds use `deny_above`, `review_between`, and `allow_below`.
- Read-only bypass uses `allowlist` with exact names or glob-like patterns.
- Heuristic customization uses `blocklist_patterns`.
- Subagent routing uses `subagent_strategy`.
- Audit logging uses the `audit` object.

## Custom Prompts

Set `prompts.system_template_path` and `prompts.user_template_path`, or place custom files in `.watchdog/system.txt` and `.watchdog/user.txt`. Example templates live in `.watchdog/prompts/*.example.txt`.

## Power User Guide

Use `.watchdog/config.power-user.example.json` as the starting point for stricter thresholds, local LLM routing, broader logging, and `tool-definition` subagent strategy.

## Architecture

- `src/config/` loads project, global, then default config.
- `src/rules/` performs Tier 1 matching.
- `src/providers/` handles Copilot and OpenAI-compatible judging.
- `src/judge/` builds prompts, parses judge output, and arbitrates verdicts.
- `src/hooks/` bridges OpenCode hooks to the evaluation pipeline.
- `src/subagent/` provides task-wrapper and tool-definition strategies.
- `src/audit/` writes JSONL audit entries and post-execution findings.

## Known Limitations

- Subagent tool calls are not intercepted by default in OpenCode (Issue #5894).
- Hook context does not include agent identity (Issue #15403).
- `ask()` is not available inside plugin hooks.
- The task wrapper strategy requires opt-in usage.
- Tool definition injection is best-effort and depends on model compliance.

## Troubleshooting

- If the plugin returns empty hooks, check `.watchdog/config.json` for invalid JSON.
- If Tier 2 never runs, verify that `provider` is configured.
- Project-local config cannot override sensitive provider fields or `audit.log_dir`; set those in your global config instead.
- If tests pass but LSP checks are missing, ensure `typescript-language-server` is installed in your environment.

## Contributing

Add providers in `src/providers/`, heuristic patterns in `src/rules/patterns.ts`, and hook behavior in `src/hooks/`. Keep changes aligned with the config schema and existing tests.
