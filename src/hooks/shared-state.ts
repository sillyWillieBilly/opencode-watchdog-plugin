import type { AuditLogger } from "@/audit/logger";
import type { EvaluationPipeline } from "@/judge/pipeline";
import { RecursionGuard } from "@/utils/recursion-guard";
import type { WatchdogConfig, WatchdogVerdict } from "@/types";

export class SharedState {
  readonly pendingReviews = new Map<string, WatchdogVerdict>();
  readonly recursionGuard = new RecursionGuard();
  toolHistory: string[] = [];
  pipeline: EvaluationPipeline | null = null;
  config: WatchdogConfig | null = null;
  auditLogger: AuditLogger | null = null;
}
