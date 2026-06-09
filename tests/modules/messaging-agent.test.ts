import { describe, it, expect, vi } from "vitest";
import { executeAiTurn } from "@/modules/messaging/ai/agent";
import { MockAIProvider } from "@/modules/messaging/ai/mock-ai-provider";

const guest = { guestId: "g1", propertyId: "p1", firstName: "Sam" };

describe("executeAiTurn", () => {
  it("persists the AI reply and runs no action for a plain message", async () => {
    const saveMessage = vi.fn().mockResolvedValue({ id: "m1" });
    const runAction = vi.fn();
    const res = await executeAiTurn({
      provider: new MockAIProvider(),
      history: [{ senderKind: "GUEST", body: "hi" }],
      guest, saveMessage, runAction,
    });
    expect(saveMessage).toHaveBeenCalledOnce();
    expect(runAction).not.toHaveBeenCalled();
    expect(res.reply).toContain("Sam");
  });

  it("executes a scripted action and links it to the AI message", async () => {
    const saveMessage = vi.fn().mockResolvedValue({ id: "m1" });
    const runAction = vi.fn().mockResolvedValue({ actionType: "Reservation", actionId: "r1" });
    const provider = new MockAIProvider({
      reply: "Booked!",
      actions: [{ type: "create_reservation", guestId: "g1", roomTypeId: "rt1", checkInDate: "2026-07-01", checkOutDate: "2026-07-03" }],
    });
    await executeAiTurn({ provider, history: [], guest, saveMessage, runAction });
    expect(runAction).toHaveBeenCalledOnce();
    expect(saveMessage).toHaveBeenCalledWith(expect.objectContaining({ actionType: "Reservation", actionId: "r1" }));
  });

  it("turns an action failure into a graceful message, not a throw", async () => {
    const saveMessage = vi.fn().mockResolvedValue({ id: "m1" });
    const runAction = vi.fn().mockRejectedValue(new Error("conflict"));
    const provider = new MockAIProvider({
      reply: "Booked!",
      actions: [{ type: "create_reservation", guestId: "g1", roomTypeId: "rt1", checkInDate: "2026-07-01", checkOutDate: "2026-07-03" }],
    });
    const res = await executeAiTurn({ provider, history: [], guest, saveMessage, runAction });
    expect(res.reply).toMatch(/couldn.t/i);
    expect(saveMessage).toHaveBeenCalled();
  });
});
