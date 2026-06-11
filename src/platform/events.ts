import { EventEmitter } from "node:events";

/**
 * In-process domain-event bus powering real-time cross-module sync (SSE).
 *
 * The booking is the origin of all information; when any module mutates a shared
 * entity it emits a DomainEvent here, and the /api/events/stream SSE endpoint
 * relays it to every connected staff client so their open views (booking grid,
 * folio, treatment grid) refetch immediately — "different windows of one entity".
 *
 * CONSTRAINT: an in-process emitter is correct only within a single server
 * instance — exactly the local-dev / thesis-demo target. A multi-instance
 * deployment (e.g. Vercel) would swap the transport for Supabase Realtime or
 * Postgres LISTEN/NOTIFY behind this same `emit` / `subscribe` interface; web
 * clients already degrade to interval polling if the stream drops.
 *
 * Stored on globalThis so Next.js HMR / route-module re-evaluation reuses one bus.
 */

/** Coarse entity buckets the UI subscribes to. */
export type DomainEntity =
  | "booking"
  | "appointment"
  | "folio"
  | "guest"
  | "room"
  | "area"
  | "housekeeping"
  | "property";

export interface DomainEvent {
  /** e.g. "booking.created", "folio.charged", "appointment.completed". */
  type: string;
  entity: DomainEntity;
  entityId: string;
  propertyId: string;
  /** ISO timestamp. */
  at: string;
}

const CHANNEL = "domain-event";

interface GlobalWithBus {
  __pmsEventBus__?: EventEmitter;
}

function emitter(): EventEmitter {
  const g = globalThis as unknown as GlobalWithBus;
  if (!g.__pmsEventBus__) {
    const e = new EventEmitter();
    // Many SSE clients may attach; lift the default 10-listener warning cap.
    e.setMaxListeners(0);
    g.__pmsEventBus__ = e;
  }
  return g.__pmsEventBus__;
}

export const eventBus = {
  /** Publish a domain event. Best-effort and never throws into the caller. */
  emit(event: Omit<DomainEvent, "at"> & { at?: string }): void {
    const full: DomainEvent = { ...event, at: event.at ?? new Date().toISOString() };
    try {
      emitter().emit(CHANNEL, full);
    } catch {
      // A failed notification must never break the business transaction.
    }
  },

  /**
   * Subscribe to events for one property. Returns an unsubscribe function.
   * Events for other properties are filtered out before the listener runs.
   */
  subscribe(propertyId: string, listener: (event: DomainEvent) => void): () => void {
    const handler = (event: DomainEvent) => {
      if (event.propertyId === propertyId) listener(event);
    };
    emitter().on(CHANNEL, handler);
    return () => emitter().off(CHANNEL, handler);
  },
};
