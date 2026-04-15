export class RecursionGuard {
  private readonly active = new Set<string>();

  isEvaluating(callId: string): boolean {
    return this.active.has(callId);
  }

  markEvaluating(callId: string): void {
    this.active.add(callId);
  }

  clearEvaluating(callId: string): void {
    this.active.delete(callId);
  }
}
