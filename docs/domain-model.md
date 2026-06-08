# Domain Model

Entity-relationship diagram for the PMS data model. Three data planes:
**operational**, **financial**, **compliance/audit**.

```mermaid
erDiagram
    Property ||--o{ Staff : employs
    Property ||--o{ RoomType : has
    Property ||--o{ Room : has
    Property ||--o{ Reservation : has
    Property ||--o{ Treatment : offers
    Property ||--o{ ServicePackage : offers
    Property ||--o{ Resource : has
    Property ||--o{ TreatmentAppointment : has
    Property ||--o{ Folio : has
    Property ||--o{ HousekeepingTask : has
    Property ||--o{ ComplianceEvent : has

    Staff ||--o{ RefreshToken : owns
    Staff ||--o{ TreatmentAppointment : "performs (therapist)"
    Staff ||--o{ HousekeepingTask : "assigned"
    Staff ||--o{ AuditLog : "actor"

    Guest ||--o{ Reservation : makes
    Guest ||--o{ TreatmentAppointment : attends
    Guest ||--o{ Folio : "billed via"

    RoomType ||--o{ Room : categorizes
    RoomType ||--o{ Reservation : "booked as"
    Room ||--o{ Reservation : "allocated to"
    Room ||--o{ HousekeepingTask : "cleaned via"

    Reservation ||--o| Folio : "opens"
    Reservation ||--o{ TreatmentAppointment : "linked"

    Treatment ||--o{ TreatmentAppointment : "scheduled as"
    Treatment ||--o{ PackageItem : "bundled in"
    ServicePackage ||--o{ PackageItem : contains
    Resource ||--o{ TreatmentAppointment : "uses"

    Folio ||--o{ FolioLineItem : "charges"
    Folio ||--o{ Payment : "receives"
```

## Data planes

| Plane | Entities |
|---|---|
| **Operational** | Property, Staff, Guest, RoomType, Room, Reservation, Treatment, ServicePackage, PackageItem, Resource, TreatmentAppointment, HousekeepingTask |
| **Financial** | Folio, FolioLineItem, Payment |
| **Compliance/Audit** | AuditLog (append-only), ComplianceEvent |

## Key invariants (enforced in the service layer)

- **Reservation conflict:** no two reservations with status ∉ {CANCELLED, NO_SHOW} share a `roomId`
  with overlapping `[checkInDate, checkOutDate)`.
- **Appointment double-booking:** a therapist and a resource each cannot have two appointments with
  status ∉ {CANCELLED, NO_SHOW} whose `[startTime, endTime)` overlap. Therapist must have role
  THERAPIST; resource type must match the treatment's `requiredResourceType`.
- **Folio balance:** Σ `FolioLineItem.amountMinor` − Σ `Payment.amountMinor`.
- **Audit:** every state-changing operation writes exactly one append-only `AuditLog` row.
