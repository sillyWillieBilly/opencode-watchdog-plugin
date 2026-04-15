import type { JudgeMessage } from "@/types";

const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

export const truncateContext = (messages: JudgeMessage[], maxTokens: number): JudgeMessage[] => {
  if (messages.length <= 1) {
    return messages;
  }

  const [system, ...rest] = messages;
  const kept: JudgeMessage[] = [];
  let budget = Math.max(maxTokens - estimateTokens(system.content), 0);

  for (let index = rest.length - 1; index >= 0; index -= 1) {
    const message = rest[index];
    const cost = estimateTokens(message.content);
    if (kept.length > 0 && cost > budget) {
      continue;
    }
    if (kept.length === 0 && cost > budget) {
      kept.unshift(message);
      budget = 0;
      continue;
    }
    if (cost <= budget) {
      kept.unshift(message);
      budget -= cost;
    }
  }

  return [system, ...kept];
};
