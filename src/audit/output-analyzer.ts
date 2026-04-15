import { matchesPattern } from "@/rules/patterns";
import type { BlocklistPattern, SuspiciousPattern } from "@/types";

const stringify = (value: unknown): string => (typeof value === "string" ? value : JSON.stringify(value));
const redactEvidence = (value: string): string => {
  if (value.length <= 8) {
    return "[redacted]";
  }

  return `${value.slice(0, 4)}***${value.slice(-4)}`;
};

export class OutputAnalyzer {
  analyzeOutput(toolName: string, args: unknown, output: unknown, blocklistPatterns: BlocklistPattern[] = []): SuspiciousPattern[] {
    const rendered = stringify(output);
    const findings: SuspiciousPattern[] = [];
    const mutationSensitiveTool = blocklistPatterns.some((pattern) => matchesPattern(toolName, pattern));

    const aws = rendered.match(/AKIA[0-9A-Z]{16}/);
    if (aws) {
      findings.push({ name: "aws_access_key", severity: "high", evidence: redactEvidence(aws[0]), description: "Potential AWS access key leaked in output" });
    }

    const jwt = rendered.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+/);
    if (jwt) {
      findings.push({ name: "jwt_token", severity: "high", evidence: redactEvidence(jwt[0]), description: "Potential JWT leaked in output" });
    }

    if (rendered.length > 10000) {
      findings.push({ name: "large_output", severity: "medium", evidence: rendered.slice(0, 120), description: "Large output may indicate data exfiltration" });
    }

    if (/write|saved|updated|deleted/i.test(rendered) && mutationSensitiveTool) {
      findings.push({ name: "unexpected_mutation", severity: "medium", evidence: rendered.slice(0, 120), description: `Read-only tool appears to have mutated data for args ${stringify(args)}` });
    }

    return findings;
  }
}
