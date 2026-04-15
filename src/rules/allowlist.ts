import type { WatchdogConfig } from "@/types";

const toRegex = (pattern: string): RegExp =>
  new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`, "i");

export const isAllowlisted = (toolName: string, config: WatchdogConfig): boolean =>
  config.allowlist.some((pattern) => toRegex(pattern).test(toolName));
