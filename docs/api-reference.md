# REST API Reference

API-only backend. All responses use the envelope:

```jsonc
// success
{ "data": <payload>, "error": null }          // list endpoints also include "meta": { page, pageSize, total }
// failure
{ "data": null, "error": { "code": "STRING", "message": "STRING", "details": <optional> } }
```

**Auth:** send `Authorization: Bearer <accessToken>` on every endpoint except `POST /api/auth/login` and `POST /api/auth/refresh`.
**Money:** all `*Minor` fields are integer minor units (HUF × 100).
**Status codes:** 200 OK · 201 Created · 204 No Content · 401 Unauthorized · 403 Forbidden · 404 Not Found · 409 Conflict (booking/double-booking/closed folio) · 422 Validation.

Required capability per endpoint is shown in brackets; see [RBAC matrix](superpowers/specs/2026-06-08-pms-backend-design.md) (spec §7).

## Auth (Phase 1)
| Method | Path | Capability | Body / Notes |
|---|---|---|---|
| POST | `/api/auth/login` | public | `{ email, password }` → `{ accessToken, refreshToken, tokenType, expiresIn }` |
| POST | `/api/auth/refresh` | public | `{ refreshToken }` → new token pair (rotates refresh token) |
| POST | `/api/auth/logout` | authenticated | `{ refreshToken }` → revokes it |
| GET | `/api/me` | authenticated | current staff profile |

## Guests (Phase 2)
| Method | Path | Capability | Body / Notes |
|---|---|---|---|
| GET | `/api/guests` | guest:read | query: `page, pageSize, search` |
| POST | `/api/guests` | guest:write | guest fields + GDPR consent flags |
| GET | `/api/guests/:id` | guest:read | |
| PATCH | `/api/guests/:id` | guest:write | partial update |
| DELETE | `/api/guests/:id` | guest:write | GDPR soft-delete (204) |

## Reservations (Phase 2)
| Method | Path | Capability | Body / Notes |
|---|---|---|---|
| GET | `/api/reservations` | reservation:read | query: `page, pageSize, status` |
| POST | `/api/reservations` | reservation:write | `{ guestId, roomTypeId, roomId?, checkInDate, checkOutDate, adults?, children?, ratePerNightMinor?, notes? }` |
| GET | `/api/reservations/:id` | reservation:read | |
| PATCH | `/api/reservations/:id` | reservation:write | dates/occupancy/notes; re-checks room conflict |
| POST | `/api/reservations/:id/assign-room` | reservation:write | `{ roomId }` — 409 on conflict |
| POST | `/api/reservations/:id/check-in` | reservation:write | requires assigned room |
| POST | `/api/reservations/:id/check-out` | reservation:write | auto-posts room-night charges to folio |
| POST | `/api/reservations/:id/cancel` | reservation:write | |
| GET | `/api/reservations/availability` | reservation:read | query: `from, to, roomTypeId?` → free rooms |

## Treatments / Packages / Resources (Phase 3)
| Method | Path | Capability | Body / Notes |
|---|---|---|---|
| GET / POST | `/api/treatments` | catalog:read / catalog:manage | treatment fields |
| GET / PATCH | `/api/treatments/:id` | catalog:read / catalog:manage | |
| GET / POST | `/api/packages` | catalog:read / catalog:manage | `{ name, priceMinor, items: [{ treatmentId, quantity }] }` |
| GET / PATCH | `/api/packages/:id` | catalog:read / catalog:manage | items replaced atomically when provided |
| GET / POST | `/api/resources` | catalog:read / catalog:manage | `{ name, type, capacity?, active? }` |
| GET / PATCH | `/api/resources/:id` | catalog:read / catalog:manage | |

## Appointments (Phase 3)
| Method | Path | Capability | Body / Notes |
|---|---|---|---|
| GET | `/api/appointments` | appointment:read | query: `page, pageSize, therapistId?, guestId?, status?` (therapists see only their own) |
| POST | `/api/appointments` | appointment:write | `{ guestId, treatmentId, therapistId, resourceId, startTime, reservationId?, notes? }` — 409 on therapist/resource double-booking |
| GET | `/api/appointments/:id` | appointment:read | |
| PATCH | `/api/appointments/:id` | appointment:write | reschedule/reassign (SCHEDULED only); re-checks conflicts |
| POST | `/api/appointments/:id/complete` | appointment:complete | auto-posts treatment charge to linked folio |
| POST | `/api/appointments/:id/cancel` | appointment:write | |
| GET | `/api/appointments/availability` | appointment:read | query: `from, to, therapistId?/resourceId?` → busy intervals |

## Folio & Payments (Phase 4)
| Method | Path | Capability | Body / Notes |
|---|---|---|---|
| GET | `/api/folios/:id` | folio:read | folio + line items + payments + `chargesMinor/paymentsMinor/balanceMinor` |
| POST | `/api/folios/:id/charges` | folio:write | `{ description, quantity?, unitPriceMinor }` (ADJUSTMENT) |
| POST | `/api/folios/:id/charge-package` | folio:write | `{ packageId }` → PACKAGE line |
| POST | `/api/folios/:id/payments` | folio:write | `{ amountMinor, method, reference? }` |
| POST | `/api/folios/:id/close` | folio:close | 409 if balance ≠ 0 |

## Reporting & Compliance (Phase 5)
| Method | Path | Capability | Body / Notes |
|---|---|---|---|
| GET | `/api/reports/occupancy` | report:read | query: `from, to` → rooms, booked room-nights, occupancyRate |
| GET | `/api/reports/revenue` | report:read | query: `from, to` → charges by type + payments (minor units) |
| GET | `/api/reports/treatment-utilization` | report:read | query: `from, to` → per-treatment counts/minutes/revenue |
| POST | `/api/compliance/ntak/daily-report` | compliance:manage | `{ date }` → builds + logs NTAK payload, persists ComplianceEvent |
| POST | `/api/compliance/nav/invoice` | compliance:manage | `{ folioId }` → builds + logs NAV invoice payload, persists ComplianceEvent |
| GET | `/api/compliance/events` | compliance:manage | logged compliance events |

## Forms & Charting — Clinical (Phase 6)
Clinical data is health-adjacent (GDPR / Infotörvény). Reception sees consent **status only**;
housekeeping has no access. Every clinical read/write is audit-logged.

| Method | Path | Capability | Body / Notes |
|---|---|---|---|
| GET / POST | `/api/form-templates` | submission:write / forms:manage | template definitions; PATCH bumps version |
| GET / PATCH | `/api/form-templates/:id` | submission:write / forms:manage | |
| POST | `/api/intake-submissions` | submission:write | `{ guestId, templateId, answers?, status? }` |
| GET | `/api/intake-submissions` | submission:write | metadata only (no answers); query `guestId?, status?` |
| GET | `/api/intake-submissions/:id` | clinical:read | full answers (therapist-scoped, audited) |
| PATCH | `/api/intake-submissions/:id` | submission:write | update answers/status |
| GET | `/api/guests/:id/consents` | consent:read | full consent records (therapist-scoped) |
| POST | `/api/guests/:id/consents` | consent:write | grant `{ type, version, text?, docRef? }` |
| GET | `/api/guests/:id/consents/status` | consent:status:read | per-type status only (granted/revoked/none) |
| POST | `/api/consents/:id/revoke` | consent:write | sets revokedAt (history preserved) |
| POST | `/api/treatment-records` | clinical:write | `{ treatmentAppointmentId, subjective?, objective?, assessment?, plan?, productsUsed?, photoRefs? }` — 409 if required consent missing |
| GET | `/api/treatment-records` | clinical:read | query `guestId?, appointmentId?` (therapist-scoped) |
| GET | `/api/treatment-records/:id` | clinical:read | therapist-scoped, audited |
| PATCH | `/api/treatment-records/:id` | clinical:write | DRAFT only; 409 once signed |
| POST | `/api/treatment-records/:id/sign` | clinical:write | human signature locks the record |
| POST | `/api/treatment-records/:id/addendum` | clinical:write | new DRAFT superseding a signed record |
