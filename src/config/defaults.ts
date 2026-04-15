import type { WatchdogConfig } from "@/types";

export const DEFAULT_CONFIG: WatchdogConfig = {
  enabled: true,
  thresholds: {
    deny_above: 0.8,
    review_between: [0.4, 0.8],
    allow_below: 0.4,
  },
  allowlist: [
    "read",
    "grep",
    "glob",
    "aft_outline",
    "aft_zoom",
    "aft_safety",
    "lsp_symbols",
    "lsp_diagnostics",
    "lsp_goto_definition",
    "lsp_find_references",
  ],
  blocklist_patterns: [],
  on_error: "allow",
  timeout_ms: 30000,
  subagent_strategy: "task-wrapper",
  loop_prevention: {
    enabled: true,
    max_consecutive: 4,
  },
  audit: {
    enabled: true,
    log_dir: ".watchdog/logs",
    log_allowed: false,
    log_denied: true,
  },
  prompts: {},
};
