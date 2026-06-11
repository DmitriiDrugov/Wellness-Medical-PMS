import { verifyAccessToken } from "@/platform/auth/jwt";
import { eventBus, type DomainEvent } from "@/platform/events";

export const dynamic = "force-dynamic";

/**
 * Server-Sent Events stream of domain events for the authenticated staff member's
 * property. Powers live cross-module sync: open views subscribe and refetch when a
 * booking / folio / appointment / guest they care about changes.
 *
 * `EventSource` cannot set an Authorization header, so the access token is passed
 * as a `?token=` query param and verified here (same secret as the Bearer path).
 */
export function GET(req: Request): Response {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return new Response("Missing token", { status: 401 });

  let propertyId: string;
  try {
    propertyId = verifyAccessToken(token).propertyId;
  } catch {
    return new Response("Invalid token", { status: 401 });
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (payload: string) => {
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Stream already closed by the client.
        }
      };

      // Initial comment flushes headers and confirms the connection is live.
      send(": connected\n\n");

      unsubscribe = eventBus.subscribe(propertyId, (event: DomainEvent) => {
        send(`event: domain\ndata: ${JSON.stringify(event)}\n\n`);
      });

      // Keep proxies from closing an idle connection.
      heartbeat = setInterval(() => send(": ping\n\n"), 25_000);
    },
    cancel() {
      unsubscribe?.();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
