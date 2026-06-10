"use client";

import { useEffect, useState } from "react";
import { api } from "@/web/api-client";
import { useApi } from "@/web/use-api";
import { useMutation } from "@/web/use-mutation";
import { useEventStream } from "@/web/use-event-stream";
import type { Property, Room, RoomType, PropertyArea, HousekeepingTask } from "@/web/types";
import { PageHeader, Card, Icon, DataState, StatusPill } from "@/web/components/ui";
import { Field } from "@/web/components/form";
import { ConfirmDialog } from "@/web/components/ConfirmDialog";
import { formatMinor } from "@/web/format";
import { PropertyMap } from "./PropertyMap";
import { RoomFormModal } from "./RoomFormModal";
import { AreaFormModal } from "./AreaFormModal";
import { TaskFormModal } from "./TaskFormModal";
import { TaskBoard } from "./TaskBoard";

type Tab = "property" | "rooms" | "map" | "housekeeping";

export default function HotelPage() {
  const [tab, setTab] = useState<Tab>("rooms");

  const property = useApi<Property>(() => api.get<Property>("/api/property"), []);
  const roomTypes = useApi<RoomType[]>(() => api.get<RoomType[]>("/api/room-types"), []);
  const rooms = useApi<Room[]>(() => api.get<Room[]>("/api/rooms"), []);
  const areas = useApi<PropertyArea[]>(() => api.get<PropertyArea[]>("/api/areas"), []);
  const tasks = useApi<HousekeepingTask[]>(() => api.get<HousekeepingTask[]>("/api/housekeeping/tasks"), []);

  useEventStream((ev) => {
    if (ev.entity === "room") { rooms.reload(); roomTypes.reload(); }
    if (ev.entity === "area") areas.reload();
    if (ev.entity === "housekeeping") tasks.reload();
    if (ev.entity === "property") property.reload();
  });

  const TABS: [Tab, string][] = [
    ["property", "Property"],
    ["rooms", "Rooms & Floors"],
    ["map", "Map"],
    ["housekeeping", "Housekeeping"],
  ];

  return (
    <div>
      <PageHeader title="Hotel Management" subtitle="Configure the property, its rooms and floors, and run housekeeping." />

      <div className="mb-5 flex flex-wrap gap-1 border-b border-outline-variant/50">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${tab === key ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "property" && <PropertyTab property={property.data} loading={property.loading} error={property.error} onSaved={property.reload} />}
      {tab === "rooms" && (
        <RoomsTab
          rooms={rooms.data ?? []}
          roomTypes={roomTypes.data ?? []}
          loading={rooms.loading || roomTypes.loading}
          error={rooms.error || roomTypes.error}
          onChanged={() => { rooms.reload(); roomTypes.reload(); }}
        />
      )}
      {tab === "map" && (
        <MapTab
          rooms={rooms.data ?? []}
          areas={areas.data ?? []}
          loading={rooms.loading || areas.loading}
          error={rooms.error || areas.error}
          onReload={() => { rooms.reload(); areas.reload(); }}
          onTaskCreated={tasks.reload}
        />
      )}
      {tab === "housekeeping" && (
        <HousekeepingTab tasks={tasks.data ?? []} loading={tasks.loading} error={tasks.error} onChanged={tasks.reload} />
      )}
    </div>
  );
}

// ---------- Property editor ----------
function PropertyTab({ property, loading, error, onSaved }: { property: Property | null; loading: boolean; error: string | null; onSaved: () => void }) {
  return (
    <DataState loading={loading} error={error}>
      {property && <PropertyForm property={property} onSaved={onSaved} />}
    </DataState>
  );
}

function PropertyForm({ property, onSaved }: { property: Property; onSaved: () => void }) {
  const save = useMutation();
  const [f, setF] = useState({ ...property });
  function set<K extends keyof Property>(k: K, v: Property[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      name: f.name, legalName: f.legalName, taxNumber: f.taxNumber, ntakRegNumber: f.ntakRegNumber,
      addressLine: f.addressLine, city: f.city, postalCode: f.postalCode, country: f.country,
      timezone: f.timezone, currency: f.currency,
      touristTaxPerPersonPerNightMinor: Number(f.touristTaxPerPersonPerNightMinor),
      touristTaxAppliesToChildren: f.touristTaxAppliesToChildren,
    };
    if ((await save.submit(() => api.patch("/api/property", body))) !== undefined) onSaved();
  }
  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-on-surface-variant">Identity</h3>
        <div className="space-y-3">
          <Field label="Name"><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Legal name"><input className="input" value={f.legalName} onChange={(e) => set("legalName", e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tax number (NAV)"><input className="input" value={f.taxNumber} onChange={(e) => set("taxNumber", e.target.value)} /></Field>
            <Field label="NTAK reg. number"><input className="input" value={f.ntakRegNumber} onChange={(e) => set("ntakRegNumber", e.target.value)} /></Field>
          </div>
        </div>
      </Card>
      <Card>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-on-surface-variant">Address & locale</h3>
        <div className="space-y-3">
          <Field label="Address line"><input className="input" value={f.addressLine} onChange={(e) => set("addressLine", e.target.value)} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="City"><input className="input" value={f.city} onChange={(e) => set("city", e.target.value)} /></Field>
            <Field label="Postal"><input className="input" value={f.postalCode} onChange={(e) => set("postalCode", e.target.value)} /></Field>
            <Field label="Country"><input className="input" value={f.country} onChange={(e) => set("country", e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Timezone"><input className="input" value={f.timezone} onChange={(e) => set("timezone", e.target.value)} /></Field>
            <Field label="Currency"><input className="input" value={f.currency} onChange={(e) => set("currency", e.target.value)} /></Field>
          </div>
        </div>
      </Card>
      <Card className="lg:col-span-2">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-on-surface-variant">Tourist tax (IFA)</h3>
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Per person / night (minor units, HUF×100)">
            <input className="input w-56" type="number" value={f.touristTaxPerPersonPerNightMinor}
              onChange={(e) => set("touristTaxPerPersonPerNightMinor", Number(e.target.value))} />
          </Field>
          <span className="pb-2 text-sm text-on-surface-variant">= {formatMinor(f.touristTaxPerPersonPerNightMinor)} / person-night</span>
          <label className="flex items-center gap-2 pb-2 text-sm text-on-surface-variant">
            <input type="checkbox" checked={f.touristTaxAppliesToChildren} onChange={(e) => set("touristTaxAppliesToChildren", e.target.checked)} />
            Charge children too (default: under-18 exempt)
          </label>
        </div>
      </Card>
      <div className="lg:col-span-2 flex items-center gap-3">
        <button className="btn-primary" disabled={save.submitting}><Icon name="settings" className="text-[18px]" /> {save.submitting ? "Saving…" : "Save property"}</button>
        {save.error && <span className="text-sm text-error">{save.error}</span>}
      </div>
    </form>
  );
}

// ---------- Rooms & floors ----------
function RoomsTab({ rooms, roomTypes, loading, error, onChanged }: { rooms: Room[]; roomTypes: RoomType[]; loading: boolean; error: string | null; onChanged: () => void }) {
  const [roomModal, setRoomModal] = useState<{ open: boolean; room: Room | null }>({ open: false, room: null });
  const [typeForm, setTypeForm] = useState({ name: "", basePriceMinor: "", maxOccupancy: "2" });
  const createType = useMutation();
  const del = useMutation();
  const [deleting, setDeleting] = useState<Room | null>(null);

  async function addType(e: React.FormEvent) {
    e.preventDefault();
    const body = { name: typeForm.name, basePriceMinor: Number(typeForm.basePriceMinor), maxOccupancy: Number(typeForm.maxOccupancy) };
    if ((await createType.submit(() => api.post("/api/room-types", body))) !== undefined) {
      setTypeForm({ name: "", basePriceMinor: "", maxOccupancy: "2" });
      onChanged();
    }
  }
  async function confirmDelete() {
    if (!deleting) return;
    if ((await del.submit(() => api.del(`/api/rooms/${deleting.id}`))) !== undefined) { setDeleting(null); onChanged(); }
  }

  const floors = [...new Set(rooms.map((r) => r.floor ?? 0))].sort((a, b) => a - b);
  const typeName = (id: string) => roomTypes.find((t) => t.id === id)?.name ?? "—";

  return (
    <DataState loading={loading} error={error}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Room types */}
        <Card>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-on-surface-variant">Room types</h3>
          <div className="mb-3 space-y-1.5">
            {roomTypes.length === 0 && <p className="text-sm text-on-surface-variant">No room types yet — add one to start.</p>}
            {roomTypes.map((rt) => (
              <div key={rt.id} className="flex items-center justify-between rounded-lg bg-surface-container-low px-3 py-2 text-sm">
                <span className="font-medium text-on-surface">{rt.name}</span>
                <span className="text-on-surface-variant">{formatMinor(rt.basePriceMinor)} · ≤{rt.maxOccupancy}</span>
              </div>
            ))}
          </div>
          <form onSubmit={addType} className="space-y-2 border-t border-outline-variant/40 pt-3">
            <input className="input" placeholder="Type name (e.g. Deluxe)" value={typeForm.name} onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input className="input" type="number" placeholder="Price (minor)" value={typeForm.basePriceMinor} onChange={(e) => setTypeForm({ ...typeForm, basePriceMinor: e.target.value })} />
              <input className="input" type="number" placeholder="Max occ." value={typeForm.maxOccupancy} onChange={(e) => setTypeForm({ ...typeForm, maxOccupancy: e.target.value })} />
            </div>
            {createType.error && <p className="text-xs text-error">{createType.error}</p>}
            <button className="btn-secondary w-full justify-center" disabled={createType.submitting || !typeForm.name || !typeForm.basePriceMinor}>
              <Icon name="add" className="text-[18px]" /> Add room type
            </button>
          </form>
        </Card>

        {/* Rooms by floor */}
        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-on-surface-variant">Rooms ({rooms.length})</h3>
            <button className="btn-primary" disabled={roomTypes.length === 0} onClick={() => setRoomModal({ open: true, room: null })}>
              <Icon name="add" className="text-[18px]" /> New room
            </button>
          </div>
          {rooms.length === 0 ? (
            <p className="py-8 text-center text-sm text-on-surface-variant">No rooms yet. New rooms appear in the Booking Grid automatically.</p>
          ) : (
            floors.map((fl) => (
              <div key={fl} className="mb-4">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">{fl === 0 ? "Ground floor" : `Floor ${fl}`}</p>
                <div className="flex flex-wrap gap-2">
                  {rooms.filter((r) => (r.floor ?? 0) === fl).map((r) => (
                    <div key={r.id} className="flex items-center gap-2 rounded-lg border border-outline-variant/50 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-on-surface">Room {r.number}</p>
                        <p className="text-xs text-on-surface-variant">{typeName(r.roomTypeId)}</p>
                      </div>
                      <StatusPill tone={r.housekeepingStatus === "CLEAN" || r.housekeepingStatus === "INSPECTED" ? "success" : r.housekeepingStatus === "OUT_OF_ORDER" ? "neutral" : "warning"}>
                        {r.housekeepingStatus.replace("_", " ")}
                      </StatusPill>
                      <button className="btn-ghost px-1.5" onClick={() => setRoomModal({ open: true, room: r })} aria-label="Edit"><Icon name="edit" className="text-[16px]" /></button>
                      <button className="btn-ghost px-1.5 text-error" onClick={() => setDeleting(r)} aria-label="Delete"><Icon name="delete" className="text-[16px]" /></button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </Card>
      </div>

      {roomModal.open && (
        <RoomFormModal open={roomModal.open} room={roomModal.room} roomTypes={roomTypes}
          onClose={() => setRoomModal({ open: false, room: null })}
          onSaved={() => { setRoomModal({ open: false, room: null }); onChanged(); }} />
      )}
      <ConfirmDialog open={deleting !== null} title="Delete room"
        message={`Delete Room ${deleting?.number ?? ""}? Rooms with reservations cannot be deleted.`}
        confirmLabel="Delete" danger busy={del.submitting} error={del.error}
        onConfirm={confirmDelete} onClose={() => setDeleting(null)} />
    </DataState>
  );
}

// ---------- Map ----------
function MapTab({ rooms, areas, loading, error, onReload, onTaskCreated }: { rooms: Room[]; areas: PropertyArea[]; loading: boolean; error: string | null; onReload: () => void; onTaskCreated: () => void }) {
  const [areaOpen, setAreaOpen] = useState(false);
  // Latch "loaded" on the first completed fetch. Background refetches (drag saves,
  // SSE events) must NOT swap the live map for a spinner — that would remount it
  // and interrupt the drag. Once ready, the map stays mounted and just re-renders.
  const [ready, setReady] = useState(false);
  useEffect(() => { if (!loading) setReady(true); }, [loading]);

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-on-surface-variant">Property map</h3>
        <button className="btn-secondary" onClick={() => setAreaOpen(true)}><Icon name="add" className="text-[18px]" /> Add area / zone</button>
      </div>
      {error ? (
        <DataState loading={false} error={error}>{null}</DataState>
      ) : !ready ? (
        <DataState loading error={null}>{null}</DataState>
      ) : (
        <PropertyMap rooms={rooms} areas={areas} onReload={onReload} onTaskCreated={onTaskCreated} />
      )}
      {areaOpen && <AreaFormModal open={areaOpen} onClose={() => setAreaOpen(false)} onSaved={() => { setAreaOpen(false); onReload(); }} />}
    </Card>
  );
}

// ---------- Housekeeping ----------
function HousekeepingTab({ tasks, loading, error, onChanged }: { tasks: HousekeepingTask[]; loading: boolean; error: string | null; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button className="btn-primary" onClick={() => setOpen(true)}><Icon name="add" className="text-[18px]" /> New task</button>
      </div>
      <DataState loading={loading} error={error}>
        <TaskBoard tasks={tasks} onChanged={onChanged} />
      </DataState>
      {open && <TaskFormModal open={open} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); onChanged(); }} />}
    </div>
  );
}
