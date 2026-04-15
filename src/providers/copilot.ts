import type { PluginInput } from "@opencode-ai/plugin";
import type { SessionPromptResponse } from "@opencode-ai/sdk";
import { withTimeout, wrapProviderError } from "@/providers/base";
import type { EvaluateOptions, LLMProvider, ProviderConfig } from "@/types";

const extractModel = (model: string): { providerID: string; modelID: string } => {
  const [providerID, ...rest] = model.split("/");
  const modelID = rest.join("/");
  if (!providerID || !modelID) {
    throw new Error(`Invalid Copilot model format: ${model}`);
  }
  return { providerID, modelID };
};

export class CopilotProvider implements LLMProvider {
  readonly name = "copilot";
  private readonly client: PluginInput["client"];
  private readonly config: ProviderConfig;
  private readonly timeoutMs: number;
  private sessionIdPromise?: Promise<string>;

  constructor(pluginInput: PluginInput, config: ProviderConfig, timeoutMs: number) {
    this.client = pluginInput.client;
    this.config = config;
    this.timeoutMs = timeoutMs;
  }

  private async getSessionId(): Promise<string> {
    if (!this.sessionIdPromise) {
      this.sessionIdPromise = (async () => {
        const response = await this.client.session.create({ body: { title: "watchdog-judge" } });
        const session = response.data;
        if (!session) {
          throw new Error("Copilot provider failed to create a session");
        }
        return session.id;
      })();
    }
    return this.sessionIdPromise;
  }

  async evaluate(systemPrompt: string, userPrompt: string, options?: EvaluateOptions): Promise<string> {
    try {
      const sessionId = await this.getSessionId();
      const model = extractModel(this.config.model);
      const timeoutMs = options?.timeout_ms ?? this.timeoutMs;

      const response = await withTimeout(
        this.client.session.prompt({
          path: { id: sessionId },
          body: {
            parts: [{ type: "text", text: userPrompt }],
            system: systemPrompt,
            model,
            noReply: false,
            tools: {},
          },
        }),
        timeoutMs,
        "Copilot provider timed out",
      );

      const payload = response.data;
      if (!payload) {
        throw new Error("Copilot provider returned an empty response");
      }

      const typedPayload: SessionPromptResponse = payload;
      const firstPart = typedPayload.parts[0];
      if (firstPart && "text" in firstPart && typeof firstPart.text === "string") {
        return firstPart.text;
      }
      throw new Error("Copilot provider returned no text response");
    } catch (error) {
      throw wrapProviderError(this.name, error);
    }
  }
}
