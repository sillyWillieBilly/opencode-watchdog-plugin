import { AuditLogger } from "@/audit/logger";
import type { WatchdogConfig } from "@/types";

export const createAuditLogger = (config: WatchdogConfig, sessionId: string): AuditLogger | null => {
  if (!config.audit.enabled) {
    return null;
  }
  return new AuditLogger(config.audit, sessionId);
};

export { AuditLogger };
