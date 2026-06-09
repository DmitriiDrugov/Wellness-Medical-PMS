/** Minimal conversation turn passed to the AI. */
export interface AiTurnMessage {
  senderKind: "GUEST" | "AI" | "STAFF";
  body: string;
}

/** A booking action the AI decided to take this turn (executed via real services). */
export type AiAction =
  | { type: "create_reservation"; guestId: string; roomTypeId: string; checkInDate: string; checkOutDate: string }
  | { type: "create_appointment"; guestId: string; treatmentId: string; therapistId: string; resourceId: string; startTime: string };

export interface AiResponse {
  reply: string;
  actions: AiAction[];
}

export interface AiGuestContext {
  guestId: string;
  propertyId: string;
  firstName: string;
}

export interface AIProvider {
  respond(history: AiTurnMessage[], guest: AiGuestContext): Promise<AiResponse>;
}
