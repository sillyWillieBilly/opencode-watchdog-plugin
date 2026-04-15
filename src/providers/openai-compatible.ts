import { withTimeout, wrapProviderError } from "@/providers/base";
import type { EvaluateOptions, LLMProvider, ProviderConfig } from "@/types";

export class OpenAICompatibleProvider implements LLMProvider {
  readonly name = "openai-compatible";

  constructor(private readonly config: ProviderConfig, private readonly timeoutMs: number) {}

  async evaluate(systemPrompt: string, userPrompt: string, options?: EvaluateOptions): Promise<string> {
    try {
      const apiKeyEnv = this.config.api_key_env;
      if (!apiKeyEnv) {
        throw new Error("OpenAI-compatible provider is missing api_key_env");
      }
      const apiKey = process.env[apiKeyEnv];
      if (!apiKey) {
        throw new Error(`Missing API key in environment variable ${apiKeyEnv}`);
      }
      if (!this.config.base_url) {
        throw new Error("OpenAI-compatible provider is missing base_url");
      }

      const response = await withTimeout(
        fetch(`${this.config.base_url.replace(/\/$/, "")}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: this.config.model,
            temperature: options?.temperature,
            max_tokens: options?.max_tokens,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          }),
        }).then(async (result) => {
          if (!result.ok) {
            throw new Error(`OpenAI-compatible API error ${result.status}: ${await result.text()}`);
          }
          return result.json() as Promise<{ choices?: Array<{ message?: { content?: string } }> }>;
        }),
        options?.timeout_ms ?? this.timeoutMs,
        "OpenAI-compatible provider timed out",
      );

      const content = response.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("OpenAI-compatible provider returned no completion content");
      }
      return content;
    } catch (error) {
      throw wrapProviderError(this.name, error);
    }
  }
}
