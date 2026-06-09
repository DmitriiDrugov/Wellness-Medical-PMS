"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/web/api-client";
import { useApi } from "@/web/use-api";
import type { ConversationDto, MessageDto } from "@/web/types";
import { PageHeader, Card, StatusPill, Icon, DataState } from "@/web/components/ui";
import { fullName, formatTime } from "@/web/format";

export default function MessagesPage() {
  const convos = useApi<ConversationDto[]>(() => api.get<ConversationDto[]>("/api/conversations", { pageSize: 100 }), []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const list = convos.data ?? [];
  const active = list.find((c) => c.id === activeId) ?? null;

  return (
    <div>
      <PageHeader title="Messages" subtitle="Guest conversations. The AI receptionist replies by default; take over to step in." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-0 lg:col-span-1">
          <DataState loading={convos.loading} error={convos.error} empty={list.length === 0} emptyLabel="No conversations yet.">
            <ul className="max-h-[72vh] overflow-y-auto">
              {list.map((c) => (
                <li key={c.id}>
                  <button onClick={() => setActiveId(c.id)}
                    className={`flex w-full items-center justify-between border-b border-outline-variant/30 px-4 py-3 text-left hover:bg-[#f4f8f7] ${activeId === c.id ? "bg-[#f4f8f7]" : ""}`}>
                    <span className="font-medium text-on-surface">{fullName(c.guest?.firstName, c.guest?.lastName)}</span>
                    <StatusPill tone={c.handling === "AI" ? "primary" : "warning"}>
                      {c.handling === "AI" ? "AI Handled" : "Needs Staff"}
                    </StatusPill>
                  </button>
                </li>
              ))}
            </ul>
          </DataState>
        </Card>
        <div className="lg:col-span-2">
          {active ? <Thread conv={active} onChanged={convos.reload} /> : <Card>Select a conversation.</Card>}
        </div>
      </div>
    </div>
  );
}

function Thread({ conv, onChanged }: { conv: ConversationDto; onChanged: () => void }) {
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [body, setBody] = useState("");
  const sinceRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    setMessages([]);
    sinceRef.current = undefined;
    let active = true;
    async function poll() {
      const { data } = await api.get<MessageDto[]>(`/api/conversations/${conv.id}/messages`, { since: sinceRef.current });
      if (!active || data.length === 0) return;
      sinceRef.current = data[data.length - 1]!.createdAt;
      setMessages((prev) => [...prev, ...data]);
    }
    poll();
    const t = setInterval(poll, 4000);
    return () => { active = false; clearInterval(t); };
  }, [conv.id]);

  async function send() {
    if (!body.trim()) return;
    await api.post(`/api/conversations/${conv.id}/messages`, { body });
    setBody("");
  }
  async function toggleHandling() {
    await api.post(`/api/conversations/${conv.id}/${conv.handling === "AI" ? "take-over" : "release"}`);
    onChanged();
  }

  return (
    <Card className="flex h-[72vh] flex-col p-0">
      <div className="flex items-center justify-between border-b border-outline-variant/50 px-5 py-3">
        <span className="font-semibold text-on-surface">{fullName(conv.guest?.firstName, conv.guest?.lastName)}</span>
        <button className="btn-secondary" onClick={toggleHandling}>
          <Icon name={conv.handling === "AI" ? "back_hand" : "smart_toy"} className="text-[18px]" />
          {conv.handling === "AI" ? "Take over" : "Release to AI"}
        </button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.senderKind === "GUEST" ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
              m.senderKind === "GUEST" ? "bg-surface-container text-on-surface"
                : m.senderKind === "AI" ? "bg-primary/10 text-on-surface" : "bg-primary text-on-primary"}`}>
              <p className="mb-0.5 text-[10px] font-semibold uppercase opacity-70">{m.senderKind}</p>
              <p className="whitespace-pre-wrap">{m.body}</p>
              {m.actionType && (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
                  <Icon name="bolt" className="text-[12px]" /> AI booked {m.actionType}
                </span>
              )}
              <p className="mt-1 text-[10px] opacity-60">{formatTime(m.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 border-t border-outline-variant/50 p-3">
        <input className="input flex-1" placeholder={conv.handling === "HUMAN" ? "Type a reply…" : "Take over to reply"}
          disabled={conv.handling !== "HUMAN"} value={body} onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()} />
        <button className="btn-primary" disabled={conv.handling !== "HUMAN"} onClick={send}>
          <Icon name="send" className="text-[18px]" />
        </button>
      </div>
    </Card>
  );
}
