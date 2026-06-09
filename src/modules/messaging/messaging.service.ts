import type { StaffAuthContext, GuestAuthContext } from "@/platform/auth/context";
import { requireCapability } from "@/platform/rbac";
import { recordAudit } from "@/platform/audit";
import { ForbiddenError, NotFoundError, ConflictError } from "@/platform/errors";
import { appointmentsService } from "@/modules/appointments/appointments.service";
import { reservationsService } from "@/modules/reservations/reservations.service";
import { conversationRepository } from "@/modules/messaging/conversation.repository";
import { messageRepository } from "@/modules/messaging/message.repository";
import { canStaffAccessConversation } from "@/modules/messaging/access";
import { executeAiTurn } from "@/modules/messaging/ai/agent";
import { getAIProvider } from "@/modules/messaging/ai";
import type { AiAction } from "@/modules/messaging/ai/ai-provider";
import type { ListConversationsQuery, ListMessagesQuery } from "@/modules/messaging/messaging.schema";

const HISTORY_LIMIT = 20;

async function aiActorFor(propertyId: string) {
  const { authRepository } = await import("@/modules/auth/auth.repository");
  const ai = await authRepository.findAiAgent(propertyId);
  if (!ai) throw new NotFoundError("AI agent principal not configured");
  return { kind: "staff" as const, staffId: ai.id, role: ai.role, propertyId };
}

async function runAiAction(
  propertyId: string,
  action: AiAction,
): Promise<{ actionType: string; actionId: string }> {
  const ctx = await aiActorFor(propertyId);
  if (action.type === "create_reservation") {
    const r = await reservationsService.create(ctx, {
      guestId: action.guestId,
      roomTypeId: action.roomTypeId,
      checkInDate: new Date(action.checkInDate),
      checkOutDate: new Date(action.checkOutDate),
      adults: 1,
      children: 0,
    });
    return { actionType: "Reservation", actionId: r.id };
  }
  const a = await appointmentsService.create(ctx, {
    guestId: action.guestId,
    treatmentId: action.treatmentId,
    therapistId: action.therapistId,
    resourceId: action.resourceId,
    startTime: new Date(action.startTime),
  });
  return { actionType: "TreatmentAppointment", actionId: a.id };
}

export const messagingService = {
  async getOrCreateForGuest(ctx: GuestAuthContext) {
    const existing = await conversationRepository.findByGuestId(ctx.guestId);
    return existing ?? conversationRepository.create({ propertyId: ctx.propertyId, guestId: ctx.guestId });
  },

  async listForStaff(ctx: StaffAuthContext, q: ListConversationsQuery) {
    requireCapability(ctx.role, "messaging:read");
    let guestIds: string[] | undefined;
    if (ctx.role === "THERAPIST") {
      const { appointmentsRepository } = await import("@/modules/appointments/appointments.repository");
      guestIds = await appointmentsRepository.guestIdsForTherapist(ctx.staffId);
    }
    const { items, total } = await conversationRepository.list({
      propertyId: ctx.propertyId,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      handling: q.handling,
      status: q.status,
      guestIds,
    });
    return { items, total, page: q.page, pageSize: q.pageSize };
  },

  async getForStaff(ctx: StaffAuthContext, id: string) {
    requireCapability(ctx.role, "messaging:read");
    const conv = await conversationRepository.findById(id);
    if (!conv || conv.propertyId !== ctx.propertyId) throw new NotFoundError("Conversation not found");
    const hasGuest =
      ctx.role === "THERAPIST"
        ? await appointmentsService.hasAppointmentWithGuest(ctx.staffId, conv.guestId)
        : false;
    if (!canStaffAccessConversation(ctx.role, ctx.staffId, conv, hasGuest)) {
      throw new ForbiddenError("Not allowed to view this conversation");
    }
    return conv;
  },

  async listMessagesForStaff(ctx: StaffAuthContext, id: string, q: ListMessagesQuery) {
    await this.getForStaff(ctx, id);
    return messageRepository.listSince(id, q.since ? new Date(q.since) : undefined, q.limit);
  },

  async listMessagesForGuest(ctx: GuestAuthContext, q: ListMessagesQuery) {
    const conv = await this.getOrCreateForGuest(ctx);
    return messageRepository.listSince(conv.id, q.since ? new Date(q.since) : undefined, q.limit);
  },

  async guestSend(ctx: GuestAuthContext, body: string) {
    let conv = await this.getOrCreateForGuest(ctx);
    if (conv.status === "CLOSED") {
      conv = await conversationRepository.update(conv.id, { status: "OPEN", handling: "AI" });
    }
    await messageRepository.create({ conversationId: conv.id, senderKind: "GUEST", body });
    await conversationRepository.update(conv.id, { lastMessageAt: new Date() });

    if (conv.handling === "AI") {
      const history = (await messageRepository.recentHistory(conv.id, HISTORY_LIMIT)).map((m) => ({
        senderKind: m.senderKind,
        body: m.body,
      }));
      await executeAiTurn({
        provider: getAIProvider(),
        history,
        guest: {
          guestId: conv.guestId,
          propertyId: conv.propertyId,
          firstName: conv.guest.firstName,
        },
        saveMessage: async (input) => {
          const msg = await messageRepository.create({
            conversationId: conv.id,
            senderKind: "AI",
            ...input,
          });
          await conversationRepository.update(conv.id, { lastMessageAt: new Date() });
          if (input.actionType && input.actionId) {
            await recordAudit({
              actorStaffId: null,
              propertyId: conv.propertyId,
              action: "CREATE",
              entityType: "Message",
              entityId: msg.id,
              metadata: { ai: true, actionType: input.actionType, actionId: input.actionId },
            });
          }
          return msg;
        },
        runAction: (action) => runAiAction(conv.propertyId, action),
      });
    }
    return messageRepository.listSince(conv.id, undefined, 100);
  },

  async staffSend(ctx: StaffAuthContext, id: string, body: string) {
    requireCapability(ctx.role, "messaging:write");
    const conv = await this.getForStaff(ctx, id);
    if (conv.status === "CLOSED") throw new ConflictError("Conversation is closed; take over to reopen");
    const msg = await messageRepository.create({
      conversationId: id,
      senderKind: "STAFF",
      senderStaffId: ctx.staffId,
      body,
    });
    await conversationRepository.update(id, { lastMessageAt: new Date() });
    return msg;
  },

  async takeOver(ctx: StaffAuthContext, id: string) {
    requireCapability(ctx.role, "messaging:write");
    await this.getForStaff(ctx, id);
    const after = await conversationRepository.update(id, {
      handling: "HUMAN",
      status: "OPEN",
      assignedStaff: { connect: { id: ctx.staffId } },
    });
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "STATE_CHANGE",
      entityType: "Conversation",
      entityId: id,
      metadata: { to: "HUMAN" },
    });
    return after;
  },

  async release(ctx: StaffAuthContext, id: string) {
    requireCapability(ctx.role, "messaging:write");
    await this.getForStaff(ctx, id);
    const after = await conversationRepository.update(id, {
      handling: "AI",
      assignedStaff: { disconnect: true },
    });
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "STATE_CHANGE",
      entityType: "Conversation",
      entityId: id,
      metadata: { to: "AI" },
    });
    return after;
  },
};
