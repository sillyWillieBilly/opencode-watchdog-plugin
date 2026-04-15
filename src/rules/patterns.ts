import type { BlocklistPattern } from "@/types";

export const BUILTIN_PATTERNS: BlocklistPattern[] = [
  { pattern: "*rm -rf /*", type: "glob", risk_level: "critical", description: "Recursive delete from root" },
  { pattern: "*rm -rf ~*", type: "glob", risk_level: "critical", description: "Recursive delete from home" },
  { pattern: "*rm -rf /**", type: "glob", risk_level: "critical", description: "Recursive delete from absolute root wildcard" },
  { pattern: "*chmod 777*", type: "glob", risk_level: "high", description: "Broad permission change" },
  { pattern: ".*\\bdd\\s+if=.+", type: "regex", risk_level: "critical", description: "Raw disk read/write command" },
  { pattern: ".*>\\s*/dev/sda\\b.*", type: "regex", risk_level: "critical", description: "Direct write to primary disk device" },
  { pattern: ".*\\bchmod\\s+-R\\s+777\\b.*", type: "regex", risk_level: "high", description: "Recursive world-writable permissions" },
  { pattern: "*curl*|*sh*", type: "glob", risk_level: "critical", description: "Pipe to shell" },
  { pattern: "*wget*|*sh*", type: "glob", risk_level: "critical", description: "Pipe to shell" },
  { pattern: "*git push --force*", type: "glob", risk_level: "high", description: "Force push" },
  { pattern: "*git reset --hard*", type: "glob", risk_level: "high", description: "Hard reset" },
  { pattern: ".*DROP TABLE.*", type: "regex", risk_level: "critical", description: "SQL drop table" },
  { pattern: ".*DELETE FROM(?!.*WHERE).*", type: "regex", risk_level: "critical", description: "Delete without where clause" },
  { pattern: ".*/(etc|root|home/[^/]+/.ssh|home/[^/]+/.config/opencode)/.*", type: "regex", risk_level: "high", description: "Sensitive path write" },
  { pattern: "*kill -9*", type: "glob", risk_level: "medium", description: "Force kill process" },
  { pattern: "*pkill*", type: "glob", risk_level: "medium", description: "Kill processes by name" },
];

const escapeRegex = (pattern: string): string => pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");

const normalizeShellishInput = (input: string): string => input.replace(/\s+/g, " ").trim();

const hasUnsafeRegexTokens = (pattern: string): boolean => /(\([^)]*[+*][^)]*\)[+*])|((?:\.\*){2,})/.test(pattern);

const hasShortFlag = (input: string, flag: string): boolean => new RegExp(`\\s-[^-\\s]*${flag}[^-\\s]*`, "i").test(input);

const matchesSpecialCase = (input: string): boolean => {
  const normalized = normalizeShellishInput(input);
  const shellPipes = /(curl|wget)[^\n|]*\|\s*(sh|bash)\b/i;
  const destructiveRm = /\brm\b/i.test(normalized) && hasShortFlag(normalized, "r") && hasShortFlag(normalized, "f") && /\s\/(\s|$|["'}\]])/i.test(normalized);
  const destructiveHomeRm = /\brm\b/i.test(normalized) && hasShortFlag(normalized, "r") && hasShortFlag(normalized, "f") && /\s~(\s|$|["'}\]])/i.test(normalized);
  const gitForce = /\bgit\s+push\s+--force(?:-with-lease)?\b/i;
  const gitResetHard = /\bgit\s+reset\s+--hard\b/i;
  return shellPipes.test(normalized) || destructiveRm || destructiveHomeRm || gitForce.test(normalized) || gitResetHard.test(normalized);
};

export const matchesPattern = (input: string, pattern: BlocklistPattern): boolean => {
  const normalized = normalizeShellishInput(input);
  if (matchesSpecialCase(normalized)) {
    return true;
  }
  if (pattern.type === "regex") {
    if (hasUnsafeRegexTokens(pattern.pattern)) {
      return false;
    }
    return new RegExp(pattern.pattern, "i").test(normalized);
  }
  return new RegExp(`^${escapeRegex(pattern.pattern)}$`, "i").test(normalized);
};
