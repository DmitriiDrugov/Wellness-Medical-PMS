import type { AIProvider, AiResponse, AiTurnMessage, AiGuestContext } from "@/modules/messaging/ai/ai-provider";

/**
 * Real LLM-backed provider. Intentionally minimal: builds a prompt from history,
 * calls the configured model, and maps tool-calls to AiAction[]. Left as a thin
 * shell so the channel runs on the mock until an API key is configured.
 */
export class RealAIProvider implements AIProvider {
  constructor(private readonly apiKey: string) {}
  async respond(_history: AiTurnMessage[], guest: AiGuestContext): Promise<AiResponse> {
    // TODO(real-llm): call model with tool schema; map tool calls → AiAction[].
    return { reply: `Hello ${guest.firstName}, how can I help?`, actions: [] };
  }
}
