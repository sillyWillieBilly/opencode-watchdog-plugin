import { truncateContext } from "@/utils/fifo-budget";
import type { JudgeMessage, ToolCallContext } from "@/types";

export const buildJudgeContext = (context: ToolCallContext, maxTokens: number): JudgeMessage[] => {
  const messages: JudgeMessage[] = [
    { role: "system", content: "Security watchdog judge context" },
    { role: "user", content: `Evaluate tool ${context.tool_name} with args ${JSON.stringify(context.args)}` },
    { role: "user", content: `Session ${context.session_id} / Call ${context.call_id}` },
  ];

  return truncateContext(messages, maxTokens);
};
