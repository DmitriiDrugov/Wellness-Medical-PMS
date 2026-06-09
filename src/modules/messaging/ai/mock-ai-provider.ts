import type { AIProvider, AiResponse, AiTurnMessage, AiGuestContext } from "@/modules/messaging/ai/ai-provider";

/**
 * Deterministic provider for tests/demos. Behaviour is driven by the latest guest
 * message text so the agent loop is exercisable with no network:
 *  - a `scripted` response (passed to the constructor) is returned verbatim — this is
 *    how tests exercise the action path (e.g. a scripted create_reservation).
 *  - otherwise: a canned reply with NO actions (a "book…room" message gets an
 *    acknowledging reply but does not auto-book in the mock).
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
