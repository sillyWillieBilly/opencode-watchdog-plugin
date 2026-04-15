import { mkdirSync } from "node:fs";
import { appendFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { AuditConfig, AuditEntry } from "@/types";

export class AuditLogger {
  private readonly logPath: string;

  constructor(private readonly config: AuditConfig, sessionId: string) {
    this.logPath = join(config.log_dir, `${sessionId}.jsonl`);
    mkdirSync(dirname(this.logPath), { recursive: true });
  }

  getLogPath(): string {
    return this.logPath;
  }

  async log(entry: AuditEntry): Promise<void> {
    if ((entry.verdict.action === "allow" && !this.config.log_allowed) || (entry.verdict.action === "deny" && !this.config.log_denied)) {
      return;
    }
    await appendFile(this.logPath, `${JSON.stringify(entry)}\n`, "utf8");
  }
}
