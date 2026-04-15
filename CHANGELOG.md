# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2025-04-15

### Added
- Plugin ID (`opencode-watchdog-plugin`) in module export for proper OpenCode registration
- Detailed error messages for denied and review-required tool calls. Old format: `Blocked (confidence: 0.9): Sensitive path write`. New format: `🛑 BLOCKED — Tool "bash" was denied (risk: high, confidence: 0.9, tier: arbitrated). Matched: Sensitive path write. Reason: Sensitive path write. Suggestions: Revise the operation before retrying.`

### Removed
- Loop Prevention Circuit Breaker (`loop_prevention` config, `LoopPreventionConfig` type, `toolHistory` on `SharedState`, detection logic in `tool-before.ts`). Removed due to conflicts with the existing pipeline eval flow during runtime testing. The complementary defense (boulder-escape-hatch skill) remains available via OhMyOpenCode skills.

### Changed
- `SharedState` now has `pipeline` property in correct order (after `recursionGuard`)
- `.gitignore` simplified (removed overly specific entries; `.watchdog/logs/` still protected)
- README reverted to concise version matching original project style