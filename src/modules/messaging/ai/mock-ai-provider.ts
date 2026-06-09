import type { AIProvider, AiResponse, AiTurnMessage, AiGuestContext } from "@/modules/messaging/ai/ai-provider";

/**
 * Deterministic provider for tests/demos. Behaviour is driven by the latest guest
 * message text so the agent loop is exercisable with no network:
 *  - contains "book a room" → emits a create_reservation action (scripted ids via env-free defaults injected by caller in tests)
 *  - otherwise → a canned greeting/echo reply, no actions.
 */
export class MockAIProvider implements AIProvider {
  constructor(private readonly scripted?: Partial<AiResponse>) {}

  async respond(history: AiTurnMessage[], guest: AiGuestContext): Promise<AiResponse> {
    if (this.scripted) return { reply: "OK", actions: [], ...this.scripted };
    const last = [...history].reverse().find((m) => m.senderKind === "GUEST")?.body ?? "";
    if (/book.*room/i.test(last)) {
      return { reply: `Sure ${guest.firstName}, I'll arrange that.`, actions: [] };
    }
    return { reply: `Hello ${guest.firstName}, how can I help with your stay?`, actions: [] };
  }
}
