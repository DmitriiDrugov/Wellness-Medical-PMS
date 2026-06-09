import type { AIProvider, AiAction, AiTurnMessage, AiGuestContext } from "@/modules/messaging/ai/ai-provider";

export interface ActionResult { actionType: string; actionId: string }

export interface ExecuteAiTurnDeps {
  provider: AIProvider;
  history: AiTurnMessage[];
  guest: AiGuestContext;
  /** Persist an AI message; returns the created row. */
  saveMessage: (input: { body: string; actionType?: string; actionId?: string }) => Promise<{ id: string }>;
  /** Execute one booking action via the real services as the AI principal. */
  runAction: (action: AiAction) => Promise<ActionResult>;
}

/**
 * One AI turn: ask the provider, persist its reply, then attempt each action it
 * chose. Action failures degrade to a graceful follow-up message — never an
 * exception — so a guest POST is never a 500 because the AI mis-stepped.
 */
export async function executeAiTurn(deps: ExecuteAiTurnDeps): Promise<{ reply: string }> {
  const response = await deps.provider.respond(deps.history, deps.guest);

  let actionType: string | undefined;
  let actionId: string | undefined;
  let failureNote: string | undefined;

  for (const action of response.actions) {
    try {
      const result = await deps.runAction(action);
      actionType = result.actionType;
      actionId = result.actionId;
    } catch {
      failureNote = "I couldn't complete that just now — a staff member will follow up.";
    }
  }

  const body = failureNote ? `${response.reply}\n\n${failureNote}` : response.reply;
  await deps.saveMessage({ body, actionType, actionId });
  return { reply: body };
}
