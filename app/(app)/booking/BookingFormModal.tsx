"use client";

import { useState } from "react";
import { api } from "@/web/api-client";
import { useApi } from "@/web/use-api";
import { useMutation } from "@/web/use-mutation";
import { Modal } from "@/web/components/Modal";
import { Field, FormError, FormActions } from "@/web/components/form";
import { fullName } from "@/web/format";
import type { Guest, RoomTypeRef } from "@/web/types";

export function BookingFormModal({
  open,
  onClose,
  onSaved,
  defaultRoomTypeId,
  defaultCheckIn,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  defaultRoomTypeId?: string;
  defaultCheckIn?: string;
}) {
  const { submit, submitting, error, fieldErrors } = useMutation();
  const guests = useApi<Guest[]>(() => api.get<Guest[]>("/api/guests", { pageSize: 100 }), []);
  const roomTypes = useApi<RoomTypeRef[]>(() => api.get<RoomTypeRef[]>("/api/room-types"), []);

  const [form, setForm] = useState({
    guestId: "",
    roomTypeId: defaultRoomTypeId ?? "",
    checkInDate: defaultCheckIn ?? "",
    checkOutDate: "",
    adults: "1",
    children: "0",
  });
  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      guestId: form.guestId,
      roomTypeId: form.roomTypeId,
      checkInDate: form.checkInDate,
      checkOutDate: form.checkOutDate,
      adults: Number(form.adults),
      children: Number(form.children),
    };
    const result = await submit(() => api.post("/api/reservations", body));
    if (result !== undefined) onSaved();
  }

  return (
    <Modal open={open} onClose={onClose} title="New Booking">
      <form onSubmit={onSubmit} className="space-y-4">
        <FormError message={error} />
        <Field label="Guest" required error={fieldErrors.guestId}>
          <select className="input" value={form.guestId} onChange={(e) => set("guestId", e.target.value)}>
            <option value="">Select guest…</option>
            {(guests.data ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {fullName(g.firstName, g.lastName)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Room type" required error={fieldErrors.roomTypeId}>
          <select className="input" value={form.roomTypeId} onChange={(e) => set("roomTypeId", e.target.value)}>
            <option value="">Select room type…</option>
            {(roomTypes.data ?? []).map((rt) => (
              <option key={rt.id} value={rt.id}>
                {rt.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Check-in" required error={fieldErrors.checkInDate}>
            <input className="input" type="date" value={form.checkInDate} onChange={(e) => set("checkInDate", e.target.value)} />
          </Field>
          <Field label="Check-out" required error={fieldErrors.checkOutDate}>
            <input className="input" type="date" value={form.checkOutDate} onChange={(e) => set("checkOutDate", e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Adults" error={fieldErrors.adults}>
            <input className="input" type="number" min={1} value={form.adults} onChange={(e) => set("adults", e.target.value)} />
          </Field>
          <Field label="Children" error={fieldErrors.children}>
            <input className="input" type="number" min={0} value={form.children} onChange={(e) => set("children", e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <FormActions onCancel={onClose} submitting={submitting} submitLabel="Create booking" />
        </div>
      </form>
    </Modal>
  );
}
