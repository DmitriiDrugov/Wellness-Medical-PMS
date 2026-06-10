# Hotel Management & Housekeeping — Design Spec

Date: 2026-06-10
Status: Approved (decisions captured 2026-06-10)

## 1. Goal

A Hotel Management console where staff configure the physical property and run
housekeeping, fully synchronized with the rest of the PMS:

- **Property editor** — edit the single Property (identity, address, tax config).
- **Rooms & floors** — create/edit/delete room types and rooms; created rooms
  appear immediately in the Booking Grid (it already reads all rooms).
- **Property map** — an **isometric 2.5D** floor plan with **editable
  drag-and-drop** room/area positions (persisted as grid coords). Two modes:
  top-down *Edit* (precise drag, snaps to grid) and isometric *View* (2.5D,
  colored by live housekeeping status, click a tile/zone to raise a task).
- **Housekeeping tasks on any part of the property** — a task targets a Room
  *or* a named Area/zone (Lobby, Pool, Spa, corridor), with a real lifecycle.
- **Mobile housekeeping endpoints** — HOUSEKEEPING staff fetch and progress their
  assigned tasks via staff-auth API (same JWT; no separate auth).

## 2. Decisions (locked)

| # | Decision | Choice |
|---|---|---|
| 1 | Map rendering | Isometric 2.5D (SVG/CSS, no 3D engine) |
| 2 | Room positioning | Editable drag-and-drop, persisted (`posX/posY`) |

## 3. Data model (Prisma) — additive, one migration

**Room** += `posX Int?`, `posY Int?`, `width Int? @default(2)`, `height Int? @default(2)`
(grid cells on the floor plan; null = not yet placed → auto-grid fallback).

**`model PropertyArea`** (non-room zones, also task targets + map tiles):
`id, propertyId, name, kind (AreaKind), floor Int?, posX/posY/width/height Int?,
notes String?, createdAt`.

**Enums**
- `AreaKind`: COMMON, POOL, SPA, RESTAURANT, CORRIDOR, BACK_OFFICE, OUTDOOR, OTHER
- `HousekeepingTaskStatus`: OPEN, IN_PROGRESS, BLOCKED, DONE
- `HousekeepingTaskType`: CLEANING, TURNDOWN, MAINTENANCE, INSPECTION, RESTOCK, OTHER
- `TaskPriority`: LOW, NORMAL, HIGH, URGENT

**HousekeepingTask** reworked (DB is empty — safe to retype):
`roomId String?` (now optional), `areaId String?` → PropertyArea, `type
HousekeepingTaskType`, `status HousekeepingTaskStatus @default(OPEN)`, `priority
TaskPriority @default(NORMAL)`, `title String`, `notes String?`,
`assignedToStaffId String?`, `createdByStaffId String?`, `createdAt`,
`startedAt DateTime?`, `completedAt DateTime?`. (Room keeps its own
`housekeepingStatus` cleanliness state — separate from task lifecycle.)

## 4. RBAC

New capability **`property:manage`** → MANAGER, ADMIN. Gates property edit,
room/room-type CRUD, room/area positioning, area CRUD.
Housekeeping reuses **`housekeeping:read` / `housekeeping:manage`** (HOUSEKEEPING,
MANAGER, ADMIN). Task creation/assignment = `housekeeping:manage`; a HOUSEKEEPING
member progresses their own tasks (start/complete) under the same capability.

## 5. Modules & endpoints

- **property module** (`src/modules/property`): `get`, `update`; areas
  `listAreas/createArea/updateArea/deleteArea`.
  - `GET/PATCH /api/property`; `GET/POST /api/areas`; `PATCH/DELETE /api/areas/[id]`.
- **reservations module**: room-type `create/update`; room `create/update/delete`
  (update covers floor, housekeepingStatus, posX/posY/size).
  - `POST /api/room-types`, `PATCH /api/room-types/[id]`;
    `POST /api/rooms`, `PATCH /api/rooms/[id]`, `DELETE /api/rooms/[id]`.
- **housekeeping module** (`src/modules/housekeeping`): `listTasks` (filters:
  status, type, assignedToStaffId, roomId, areaId, mine), `createTask`,
  `updateTask`, `start`, `complete`; `myTasks(staffId)`.
  - `GET/POST /api/housekeeping/tasks`; `PATCH /api/housekeeping/tasks/[id]`;
    `POST /api/housekeeping/tasks/[id]/start|complete`;
    **`GET /api/housekeeping/me/tasks`** (mobile — tasks assigned to the caller).
- Domain events: `room.*`, `area.*`, `housekeeping.*` on the existing `eventBus`
  (new `room`/`housekeeping` entities) so the Map, board, and Booking Grid refetch
  live. Extend `DomainEntity` with `area` and `housekeeping`.

## 6. Pure-logic (tested)

- `canTransition(from, to)` for the task lifecycle (OPEN→IN_PROGRESS→DONE, BLOCKED
  toggles; no resurrecting DONE).
- `autoPlace(items, floorWidth)` — deterministic grid fallback position for
  rooms/areas lacking `posX/posY`.

## 7. UI

- **`/hotel`** (nav "Hotel", `property:manage`) with tabs:
  *Property* (editor), *Rooms & Floors* (type + room CRUD, floor grouping),
  *Map* (isometric 2.5D, Edit/View modes, drag-to-place, click-to-create-task),
  *Housekeeping* (task list + create).
- **`/housekeeping`** stub → live kanban board (OPEN / IN_PROGRESS / BLOCKED /
  DONE) reading real tasks; assign + progress; also the in-browser stand-in for
  the mobile view. SSE-live.
- Booking Grid unchanged — new rooms appear automatically.

## 8. Non-goals (YAGNI)

True WebGL 3D; multi-building/wing hierarchy; per-area cleanliness status; offline
mobile sync; a separate housekeeping mobile login (staff JWT is reused).
