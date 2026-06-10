"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/web/api-client";
import { autoPlace } from "@/modules/property/layout";
import type { Room, PropertyArea, HousekeepingState } from "@/web/types";
import { Icon } from "@/web/components/ui";

const CELL = 46; // px per grid cell
const COLS = 14; // board width in cells

type Mode = "view" | "edit";

interface Tile {
  id: string;
  kind: "room" | "area";
  label: string;
  sub: string;
  posX: number;
  posY: number;
  width: number;
  height: number;
  top: string;
  side: string;
  text: string;
}

const ROOM_COLORS: Record<HousekeepingState, { top: string; side: string; text: string }> = {
  CLEAN: { top: "#bbf7d0", side: "#16a34a", text: "#14532d" },
  DIRTY: { top: "#fde68a", side: "#d97706", text: "#7c2d12" },
  INSPECTED: { top: "#bfdbfe", side: "#2563eb", text: "#1e3a8a" },
  OUT_OF_ORDER: { top: "#e5e7eb", side: "#6b7280", text: "#374151" },
};
const AREA_COLOR = { top: "#99f6e4", side: "#0d9488", text: "#134e4a" };

export function PropertyMap({
  rooms,
  areas,
  onReload,
  onCreateTask,
}: {
  rooms: Room[];
  areas: PropertyArea[];
  onReload: () => void;
  onCreateTask: (preset: { roomId?: string; areaId?: string; label: string }) => void;
}) {
  const floors = useMemo(() => {
    const set = new Set<number>();
    rooms.forEach((r) => set.add(r.floor ?? 0));
    areas.forEach((a) => set.add(a.floor ?? 0));
    if (set.size === 0) set.add(0);
    return [...set].sort((a, b) => a - b);
  }, [rooms, areas]);

  const [floor, setFloor] = useState(() => floors[0] ?? 0);
  const [mode, setMode] = useState<Mode>("view");
  // Optimistic position overrides while dragging / just after a save.
  const [overrides, setOverrides] = useState<Record<string, { posX: number; posY: number }>>({});
  const overridesRef = useRef(overrides);
  overridesRef.current = overrides;
  const boardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; kind: "room" | "area"; offX: number; offY: number } | null>(null);

  const activeFloor = floors.includes(floor) ? floor : floors[0] ?? 0;

  const tiles: Tile[] = useMemo(() => {
    const floorRooms = rooms
      .filter((r) => (r.floor ?? 0) === activeFloor)
      .map((r) => ({ ...r, _kind: "room" as const }));
    const floorAreas = areas
      .filter((a) => (a.floor ?? 0) === activeFloor)
      .map((a) => ({ ...a, _kind: "area" as const }));
    const placeable = [...floorRooms, ...floorAreas].map((t) => ({
      posX: overrides[t.id]?.posX ?? t.posX,
      posY: overrides[t.id]?.posY ?? t.posY,
      width: t.width,
      height: t.height,
      _ref: t,
    }));
    return autoPlace(placeable, COLS).map((p) => {
      const t = p._ref;
      if (t._kind === "room") {
        const c = ROOM_COLORS[t.housekeepingStatus];
        return { id: t.id, kind: "room" as const, label: `Room ${t.number}`, sub: t.housekeepingStatus.replace("_", " "), posX: p.posX, posY: p.posY, width: t.width, height: t.height, ...c };
      }
      return { id: t.id, kind: "area" as const, label: t.name, sub: t.kind, posX: p.posX, posY: p.posY, width: t.width, height: t.height, ...AREA_COLOR };
    });
  }, [rooms, areas, activeFloor, overrides]);

  const rows = Math.max(8, ...tiles.map((t) => t.posY + t.height + 1));

  // Drag handling (edit mode only).
  useEffect(() => {
    if (mode !== "edit") return;
    function onMove(e: PointerEvent) {
      if (!drag.current || !boardRef.current) return;
      const rect = boardRef.current.getBoundingClientRect();
      const cx = Math.round((e.clientX - rect.left - drag.current.offX) / CELL);
      const cy = Math.round((e.clientY - rect.top - drag.current.offY) / CELL);
      setOverrides((o) => ({ ...o, [drag.current!.id]: { posX: Math.max(0, cx), posY: Math.max(0, cy) } }));
    }
    async function onUp() {
      const d = drag.current;
      drag.current = null;
      if (!d) return;
      const pos = overridesRef.current[d.id];
      if (pos) {
        const path = d.kind === "room" ? `/api/rooms/${d.id}` : `/api/areas/${d.id}`;
        try {
          await api.patch(path, pos);
          onReload();
        } catch {
          /* keep optimistic position; next reload reconciles */
        }
      }
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [mode, onReload]);

  function onTilePointerDown(e: React.PointerEvent, t: Tile) {
    if (mode !== "edit" || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    drag.current = { id: t.id, kind: t.kind, offX: e.clientX - rect.left - t.posX * CELL, offY: e.clientY - rect.top - t.posY * CELL };
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded-lg border border-outline-variant/60">
          {floors.map((f) => (
            <button
              key={f}
              onClick={() => setFloor(f)}
              className={`px-3 py-1.5 text-sm font-medium transition ${activeFloor === f ? "bg-primary text-on-primary" : "bg-surface text-on-surface-variant hover:bg-surface-container-high"}`}
            >
              {f === 0 ? "Ground" : `Floor ${f}`}
            </button>
          ))}
        </div>
        <div className="ml-auto inline-flex overflow-hidden rounded-lg border border-outline-variant/60">
          {(["view", "edit"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-1.5 text-sm font-medium capitalize transition ${mode === m ? "bg-primary text-on-primary" : "bg-surface text-on-surface-variant hover:bg-surface-container-high"}`}
            >
              {m === "view" ? "3D view" : "Edit layout"}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-3 text-xs text-on-surface-variant">
        {mode === "edit"
          ? "Drag tiles to lay out the floor — positions save automatically."
          : "Click a room or area to raise a housekeeping task. Rooms are colored by cleanliness status."}
      </p>

      {/* Stage */}
      <div className="overflow-auto rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-8">
        <div style={{ perspective: mode === "view" ? "1400px" : "none" }}>
          <div
            ref={boardRef}
            className="relative mx-auto transition-transform duration-300"
            style={{
              width: COLS * CELL,
              height: rows * CELL,
              transform: mode === "view" ? "rotateX(52deg) rotateZ(-18deg)" : "none",
              transformStyle: "preserve-3d",
              backgroundImage:
                mode === "edit"
                  ? "linear-gradient(#0000000a 1px, transparent 1px), linear-gradient(90deg, #0000000a 1px, transparent 1px)"
                  : "none",
              backgroundSize: `${CELL}px ${CELL}px`,
            }}
          >
            {tiles.length === 0 && (
              <div className="absolute inset-0 grid place-items-center text-sm text-on-surface-variant">
                No rooms or areas on this floor yet.
              </div>
            )}
            {tiles.map((t) => (
              <button
                key={t.id}
                onPointerDown={(e) => onTilePointerDown(e, t)}
                onClick={() => {
                  if (mode === "view") {
                    onCreateTask(t.kind === "room" ? { roomId: t.id, label: t.label } : { areaId: t.id, label: t.label });
                  }
                }}
                className={`absolute flex flex-col items-center justify-center rounded-md text-center ${mode === "edit" ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
                style={{
                  left: t.posX * CELL + 3,
                  top: t.posY * CELL + 3,
                  width: t.width * CELL - 6,
                  height: t.height * CELL - 6,
                  background: t.top,
                  color: t.text,
                  borderBottom: `${mode === "view" ? 10 : 2}px solid ${t.side}`,
                  boxShadow: mode === "view" ? `0 10px 14px #00000033` : "0 1px 2px #0000001a",
                }}
                title={`${t.label} · ${t.sub}`}
              >
                <Icon name={t.kind === "room" ? "meeting_room" : "spa"} className="text-[16px]" />
                <span className="px-1 text-[11px] font-semibold leading-tight">{t.label}</span>
                <span className="text-[9px] uppercase opacity-70">{t.sub}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-on-surface-variant">
        {(Object.keys(ROOM_COLORS) as HousekeepingState[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className="h-3 w-4 rounded" style={{ background: ROOM_COLORS[s].top, borderBottom: `3px solid ${ROOM_COLORS[s].side}` }} />
            {s.replace("_", " ")}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-4 rounded" style={{ background: AREA_COLOR.top, borderBottom: `3px solid ${AREA_COLOR.side}` }} />
          Area / zone
        </span>
      </div>
    </div>
  );
}
