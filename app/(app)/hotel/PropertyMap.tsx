"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/web/api-client";
import { useApi } from "@/web/use-api";
import { autoPlace } from "@/modules/property/layout";
import type { Room, RoomType, PropertyArea, HousekeepingState, StaffRef } from "@/web/types";
import { Icon } from "@/web/components/ui";

const CELL = 84; // px per grid cell — cards read like the Stitch floor plan
const COLS = 12;

interface RoomStyle {
  badgeBg: string;
  badgeText: string;
  cardBg: string;
  border: string;
}
const ROOM_STYLE: Record<HousekeepingState, RoomStyle> = {
  CLEAN: { badgeBg: "#dcfce7", badgeText: "#15803d", cardBg: "#ffffff", border: "#e6efe9" },
  DIRTY: { badgeBg: "#fee2e2", badgeText: "#b91c1c", cardBg: "#fef5f5", border: "#f6d6d6" },
  INSPECTED: { badgeBg: "#dbeafe", badgeText: "#1d4ed8", cardBg: "#ffffff", border: "#d7e3f7" },
  OUT_OF_ORDER: { badgeBg: "#fef3c7", badgeText: "#92400e", cardBg: "#fffdf5", border: "#f0e4c4" },
};
const STATUS_LABEL: Record<HousekeepingState, string> = {
  CLEAN: "Clean", DIRTY: "Dirty", INSPECTED: "Inspected", OUT_OF_ORDER: "Out of order",
};

interface Tile {
  id: string;
  kind: "room" | "area";
  posX: number;
  posY: number;
  width: number;
  height: number;
  // room
  number?: string;
  typeName?: string;
  status?: HousekeepingState;
  // area
  name?: string;
  areaKind?: string;
}

export function PropertyMap({
  rooms,
  areas,
  onReload,
  onTaskCreated,
}: {
  rooms: Room[];
  areas: PropertyArea[];
  onReload: () => void;
  onTaskCreated: () => void;
}) {
  const roomTypes = useApi<RoomType[]>(() => api.get<RoomType[]>("/api/room-types"), []);
  const staff = useApi<StaffRef[]>(() => api.get<StaffRef[]>("/api/staff"), []);
  const typeName = (id: string) => roomTypes.data?.find((t) => t.id === id)?.name ?? "Room";

  const floors = useMemo(() => {
    const set = new Set<number>();
    rooms.forEach((r) => set.add(r.floor ?? 0));
    areas.forEach((a) => set.add(a.floor ?? 0));
    if (set.size === 0) set.add(0);
    return [...set].sort((a, b) => a - b);
  }, [rooms, areas]);

  const [floor, setFloor] = useState(() => floors[0] ?? 0);
  const activeFloor = floors.includes(floor) ? floor : floors[0] ?? 0;

  const [overrides, setOverrides] = useState<Record<string, { posX: number; posY: number }>>({});
  const overridesRef = useRef(overrides);
  overridesRef.current = overrides;
  const boardRef = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ id: string; kind: "room" | "area"; sx: number; sy: number; offX: number; offY: number; moved: boolean } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const [popover, setPopover] = useState<{ tile: Tile } | null>(null);

  const tiles: Tile[] = useMemo(() => {
    const fr = rooms.filter((r) => (r.floor ?? 0) === activeFloor).map((r) => ({ ...r, _kind: "room" as const }));
    const fa = areas.filter((a) => (a.floor ?? 0) === activeFloor).map((a) => ({ ...a, _kind: "area" as const }));
    const placeable = [...fr, ...fa].map((t) => ({
      posX: overrides[t.id]?.posX ?? t.posX,
      posY: overrides[t.id]?.posY ?? t.posY,
      width: t.width,
      height: t.height,
      _ref: t,
    }));
    return autoPlace(placeable, COLS).map((p) => {
      const t = p._ref;
      return t._kind === "room"
        ? { id: t.id, kind: "room" as const, posX: p.posX, posY: p.posY, width: t.width, height: t.height, number: t.number, typeName: typeName(t.roomTypeId), status: t.housekeepingStatus }
        : { id: t.id, kind: "area" as const, posX: p.posX, posY: p.posY, width: t.width, height: t.height, name: t.name, areaKind: t.kind };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms, areas, activeFloor, overrides, roomTypes.data]);

  const rows = Math.max(6, ...tiles.map((t) => t.posY + t.height + 1));

  // Drag (soft): move follows the pointer; a release without movement opens the popover.
  useEffect(() => {
    function onMove(e: PointerEvent) {
      const p = pointer.current;
      if (!p || !boardRef.current) return;
      if (!p.moved && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < 5) return;
      p.moved = true;
      setDraggingId(p.id);
      const rect = boardRef.current.getBoundingClientRect();
      const cx = Math.round((e.clientX - rect.left - p.offX) / CELL);
      const cy = Math.round((e.clientY - rect.top - p.offY) / CELL);
      setOverrides((o) => ({ ...o, [p.id]: { posX: Math.max(0, Math.min(COLS - 1, cx)), posY: Math.max(0, cy) } }));
    }
    async function onUp() {
      const p = pointer.current;
      pointer.current = null;
      setDraggingId(null);
      if (!p) return;
      if (!p.moved) {
        const tile = tilesRef.current.find((t) => t.id === p.id);
        if (tile) setPopover({ tile });
        return;
      }
      const pos = overridesRef.current[p.id];
      if (pos) {
        try {
          await api.patch(p.kind === "room" ? `/api/rooms/${p.id}` : `/api/areas/${p.id}`, pos);
          onReload();
        } catch { /* keep optimistic */ }
      }
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [onReload]);

  const tilesRef = useRef(tiles);
  tilesRef.current = tiles;

  function onTilePointerDown(e: React.PointerEvent, t: Tile) {
    if (!boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    pointer.current = { id: t.id, kind: t.kind, sx: e.clientX, sy: e.clientY, offX: e.clientX - rect.left - t.posX * CELL, offY: e.clientY - rect.top - t.posY * CELL, moved: false };
  }

  const counts = useMemo(() => {
    const fr = rooms.filter((r) => (r.floor ?? 0) === activeFloor);
    return { rooms: fr.length, dirty: fr.filter((r) => r.housekeepingStatus === "DIRTY").length };
  }, [rooms, activeFloor]);

  return (
    <div>
      {/* Floor tabs (in-map switching) + legend */}
      <div className="mb-1 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-outline-variant/40 pb-2">
        <div className="flex items-center gap-5">
          {floors.map((f) => (
            <button
              key={f}
              onClick={() => { setFloor(f); setPopover(null); }}
              className={`relative pb-1 text-sm font-semibold transition ${activeFloor === f ? "text-primary" : "text-on-surface-variant hover:text-on-surface"}`}
            >
              {f === 0 ? "Ground" : `Floor ${f}`}
              {activeFloor === f && <span className="absolute -bottom-[9px] left-0 right-0 h-0.5 rounded-full bg-primary" />}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3 text-xs text-on-surface-variant">
          {(["CLEAN", "DIRTY", "INSPECTED"] as HousekeepingState[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: ROOM_STYLE[s].badgeText }} />
              {STATUS_LABEL[s]}
            </span>
          ))}
        </div>
      </div>
      <p className="mb-3 text-xs text-on-surface-variant">Drag tiles to arrange the floor — changes save automatically. Tap a tile to assign a task.</p>

      {/* Stage */}
      <div className="relative overflow-auto rounded-2xl border border-outline-variant/40 bg-[#fafbfb] p-6" onClick={(e) => { if (e.target === e.currentTarget) setPopover(null); }}>
        <div
          ref={boardRef}
          className="relative mx-auto"
          style={{
            width: COLS * CELL,
            height: rows * CELL,
            backgroundImage: "radial-gradient(#0000000d 1px, transparent 1px)",
            backgroundSize: `${CELL / 2}px ${CELL / 2}px`,
          }}
        >
          {tiles.length === 0 && (
            <div className="absolute inset-0 grid place-items-center text-sm text-on-surface-variant">No rooms or areas on this floor yet.</div>
          )}
          {tiles.map((t) => {
            const isDragging = draggingId === t.id;
            const style = t.kind === "room" ? ROOM_STYLE[t.status ?? "DIRTY"] : null;
            return (
              <div
                key={t.id}
                onPointerDown={(e) => onTilePointerDown(e, t)}
                className="group absolute touch-none select-none"
                style={{
                  left: t.posX * CELL + 6,
                  top: t.posY * CELL + 6,
                  width: t.width * CELL - 12,
                  height: t.height * CELL - 12,
                  transition: isDragging ? "none" : "left .22s cubic-bezier(.22,1,.36,1), top .22s cubic-bezier(.22,1,.36,1), box-shadow .15s ease",
                  zIndex: isDragging ? 30 : popover?.tile.id === t.id ? 20 : 1,
                  cursor: isDragging ? "grabbing" : "grab",
                }}
              >
                {t.kind === "room" ? (
                  <div
                    className="flex h-full w-full flex-col rounded-xl p-3 shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-md"
                    style={{ background: style!.cardBg, border: `1px solid ${style!.border}`, outline: popover?.tile.id === t.id ? "2px solid var(--color-primary, #0e9384)" : "none", outlineOffset: 2 }}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">{t.typeName}</span>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: style!.badgeBg, color: style!.badgeText }}>
                        {STATUS_LABEL[t.status ?? "DIRTY"]}
                      </span>
                    </div>
                    <span className="mt-auto text-2xl font-bold leading-none text-on-surface">{t.number}</span>
                    <span className="mt-1 flex items-center gap-1 text-[11px] text-on-surface-variant">
                      <Icon name="cleaning_services" className="text-[13px]" /> Tap to assign
                    </span>
                  </div>
                ) : (
                  <div
                    className="flex h-full w-full flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant bg-surface-container-high/60 p-2 text-center shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-md"
                    style={{ outline: popover?.tile.id === t.id ? "2px solid var(--color-primary, #0e9384)" : "none", outlineOffset: 2 }}
                  >
                    <Icon name="spa" className="text-[18px] text-on-surface-variant" />
                    <span className="mt-1 text-xs font-semibold text-on-surface">{t.name}</span>
                    <span className="text-[10px] uppercase tracking-wide text-on-surface-variant">{t.areaKind}</span>
                  </div>
                )}
              </div>
            );
          })}

          {popover && (
            <TilePopover
              key={popover.tile.id}
              tile={popover.tile}
              boardWidth={COLS * CELL}
              staff={staff.data ?? []}
              onClose={() => setPopover(null)}
              onReload={onReload}
              onTaskCreated={() => { onTaskCreated(); setPopover(null); }}
            />
          )}
        </div>

        {/* Floating floor stats (Stitch) */}
        <div className="pointer-events-none absolute bottom-4 right-4 flex gap-2">
          <div className="rounded-xl border border-outline-variant/50 bg-surface/90 px-3 py-2 text-center shadow-sm backdrop-blur">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Rooms on floor</p>
            <p className="text-lg font-bold text-on-surface">{counts.rooms}</p>
          </div>
          <div className="rounded-xl border border-outline-variant/50 bg-surface/90 px-3 py-2 text-center shadow-sm backdrop-blur">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Dirty</p>
            <p className="text-lg font-bold text-error">{counts.dirty}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
const TASK_TYPES = ["CLEANING", "TURNDOWN", "MAINTENANCE", "INSPECTION", "RESTOCK"] as const;
const PRIORITIES = ["NORMAL", "HIGH", "URGENT"] as const;
const ROOM_STATUSES: HousekeepingState[] = ["CLEAN", "DIRTY", "INSPECTED", "OUT_OF_ORDER"];

/** Apple-style context popover that springs up from a tap on a tile. */
function TilePopover({
  tile,
  boardWidth,
  staff,
  onClose,
  onReload,
  onTaskCreated,
}: {
  tile: Tile;
  boardWidth: number;
  staff: StaffRef[];
  onClose: () => void;
  onReload: () => void;
  onTaskCreated: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const [type, setType] = useState<(typeof TASK_TYPES)[number]>("CLEANING");
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>("NORMAL");
  const [assignee, setAssignee] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const W = 288;
  const tileLeft = tile.posX * CELL;
  const tileRight = tileLeft + tile.width * CELL;
  const placeRight = tileRight + 12 + W <= boardWidth;
  const left = placeRight ? tileRight + 12 : Math.max(0, tileLeft - W - 12);
  const top = tile.posY * CELL;
  const originX = placeRight ? "left" : "right";

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    // Defer outside-click listener so the opening click doesn't immediately close it.
    const t = setTimeout(() => document.addEventListener("mousedown", onDown), 0);
    document.addEventListener("keydown", onKey);
    return () => { cancelAnimationFrame(id); clearTimeout(t); document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [onClose]);

  const label = tile.kind === "room" ? `Room ${tile.number}` : tile.name ?? "Area";
  const housekeepers = staff.filter((s) => ["HOUSEKEEPING", "MANAGER", "ADMIN"].includes(s.role));

  async function setRoomStatus(status: HousekeepingState) {
    if (tile.kind !== "room") return;
    setBusy(true); setError(null);
    try { await api.patch(`/api/rooms/${tile.id}`, { housekeepingStatus: status }); onReload(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function createTask() {
    setBusy(true); setError(null);
    try {
      await api.post("/api/housekeeping/tasks", {
        title: `${type[0]}${type.slice(1).toLowerCase()} · ${label}`,
        type,
        priority,
        roomId: tile.kind === "room" ? tile.id : undefined,
        areaId: tile.kind === "area" ? tile.id : undefined,
        assignedToStaffId: assignee || undefined,
      });
      onTaskCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create task");
      setBusy(false);
    }
  }

  return (
    <div
      ref={ref}
      className="absolute z-40 w-72 rounded-2xl border border-black/5 bg-surface/95 p-3 shadow-2xl backdrop-blur-xl"
      style={{
        left, top, transformOrigin: `${originX} top`,
        transform: shown ? "scale(1) translateY(0)" : "scale(.9) translateY(6px)",
        opacity: shown ? 1 : 0,
        transition: "transform .2s cubic-bezier(.34,1.56,.64,1), opacity .15s ease",
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-on-surface">{label}</p>
        <button className="grid h-6 w-6 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container-high" onClick={onClose} aria-label="Close">
          <Icon name="close" className="text-[16px]" />
        </button>
      </div>

      {tile.kind === "room" && (
        <div className="mb-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Set status</p>
          <div className="flex gap-1">
            {ROOM_STATUSES.map((s) => (
              <button key={s} disabled={busy} onClick={() => setRoomStatus(s)}
                className="flex-1 rounded-lg px-1 py-1.5 text-[10px] font-semibold uppercase transition hover:brightness-95"
                style={{ background: ROOM_STYLE[s].badgeBg, color: ROOM_STYLE[s].badgeText }}>
                {s === "OUT_OF_ORDER" ? "OOO" : STATUS_LABEL[s].split(" ")[0]}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Assign a task</p>
      <div className="mb-2 flex flex-wrap gap-1">
        {TASK_TYPES.map((tt) => (
          <button key={tt} onClick={() => setType(tt)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${type === tt ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"}`}>
            {tt[0] + tt.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div className="mb-2 flex items-center gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Priority</span>
        {PRIORITIES.map((p) => (
          <button key={p} onClick={() => setPriority(p)}
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition ${priority === p ? "bg-on-surface text-surface" : "bg-surface-container-high text-on-surface-variant"}`}>
            {p[0] + p.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Assign to</p>
      <div className="mb-3 max-h-32 space-y-1 overflow-y-auto">
        <button onClick={() => setAssignee("")}
          className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${assignee === "" ? "bg-primary/10 text-primary" : "hover:bg-surface-container-high"}`}>
          <span className="grid h-7 w-7 place-items-center rounded-full bg-surface-container-high text-xs">—</span>
          Unassigned
        </button>
        {housekeepers.map((s) => (
          <button key={s.id} onClick={() => setAssignee(s.id)}
            className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${assignee === s.id ? "bg-primary/10 text-primary" : "hover:bg-surface-container-high"}`}>
            <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
              {(s.firstName[0] ?? "") + (s.lastName[0] ?? "")}
            </span>
            <span className="truncate">{s.firstName} {s.lastName}</span>
            <span className="ml-auto text-[10px] uppercase text-on-surface-variant">{s.role.slice(0, 4)}</span>
          </button>
        ))}
      </div>

      {error && <p className="mb-2 text-xs text-error">{error}</p>}
      <button onClick={createTask} disabled={busy} className="btn-primary w-full justify-center">
        <Icon name="add" className="text-[18px]" /> {busy ? "Working…" : "Create task"}
      </button>
    </div>
  );
}
