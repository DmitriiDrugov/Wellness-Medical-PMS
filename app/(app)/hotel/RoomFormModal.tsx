"use client";

import { useState } from "react";
import { api } from "@/web/api-client";
import { useMutation } from "@/web/use-mutation";
import { Modal } from "@/web/components/Modal";
import { Field, FormError, FormActions } from "@/web/components/form";
import type { Room, RoomType } from "@/web/types";

const STATES = ["CLEAN", "DIRTY", "INSPECTED", "OUT_OF_ORDER"];

export function RoomFormModal({
  open,
  room,
  roomTypes,
  onClose,
  onSaved,
}: {
  open: boolean;
  room: Room | null; // null => create
  roomTypes: RoomType[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { submit, submitting, error, fieldErrors } = useMutation();
  const [form, setForm] = useState({
    number: room?.number ?? "",
    roomTypeId: room?.roomTypeId ?? roomTypes[0]?.id ?? "",
    floor: room?.floor != null ? String(room.floor) : "0",
    housekeepingStatus: room?.housekeepingStatus ?? "DIRTY",
  });
  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      number: form.number,
      roomTypeId: form.roomTypeId,
      floor: form.floor === "" ? undefined : Number(form.floor),
      ...(room ? { housekeepingStatus: form.housekeepingStatus } : {}),
    };
    const res = room
      ? await submit(() => api.patch(`/api/rooms/${room.id}`, body))
      : await submit(() => api.post("/api/rooms", body));
    if (res !== undefined) onSaved();
  }

  return (
    <Modal open={open} onClose={onClose} title={room ? `Edit Room ${room.number}` : "New room"}>
      <form onSubmit={onSubmit} className="space-y-4">
        <FormError message={error} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Room number" required error={fieldErrors.number}>
            <input className="input" value={form.number} onChange={(e) => set("number", e.target.value)} />
          </Field>
          <Field label="Floor" error={fieldErrors.floor}>
            <input className="input" type="number" value={form.floor} onChange={(e) => set("floor", e.target.value)} />
          </Field>
        </div>
        <Field label="Room type" required error={fieldErrors.roomTypeId}>
          <select className="input" value={form.roomTypeId} onChange={(e) => set("roomTypeId", e.target.value)}>
            {roomTypes.map((rt) => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
          </select>
        </Field>
        {room && (
          <Field label="Housekeeping status">
            <select className="input" value={form.housekeepingStatus} onChange={(e) => set("housekeepingStatus", e.target.value)}>
              {STATES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </select>
          </Field>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <FormActions onCancel={onClose} submitting={submitting} submitLabel={room ? "Save room" : "Create room"} />
        </div>
      </form>
    </Modal>
  );
}
