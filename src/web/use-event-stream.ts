"use client";

import { useEffect, useRef } from "react";
import { getStoredAccessToken } from "@/web/api-client";

/** Domain event shape mirrored from src/platform/events.ts. */
export interface DomainEvent {
  type: string;
  entity: "booking" | "appointment" | "folio" | "guest" | "room";
  entityId: string;
  propertyId: string;
  at: string;
}

/**
 * Subscribe to the server's domain-event SSE stream and invoke `onEvent` for each
 * event. This is what makes modules feel like "windows of one entity": when a
 * booking, folio or appointment changes anywhere, open views refetch instantly.
 *
 * Resilience: `EventSource` bakes the access token into the connect URL, so on
 * error we close and reconnect with a freshly-read token (handling token
 * rotation). The caller's own `reload()` polling remains a safety net if the
 * stream can never establish.
 */
export function useEventStream(onEvent: (event: DomainEvent) => void): void {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    const connect = () => {
      if (closed) return;
      const token = getStoredAccessToken();
      if (!token) {
        retry = setTimeout(connect, 5_000);
        return;
      }
      source = new EventSource(`/api/events/stream?token=${encodeURIComponent(token)}`);
      source.addEventListener("domain", (e) => {
        try {
          handlerRef.current(JSON.parse((e as MessageEvent).data) as DomainEvent);
        } catch {
          // Ignore malformed payloads.
        }
      });
      source.onerror = () => {
        source?.close();
        source = null;
        if (!closed) retry = setTimeout(connect, 3_000);
      };
    };

    connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      source?.close();
    };
  }, []);
}
