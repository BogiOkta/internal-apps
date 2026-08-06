# Vacation Module

Vacation owns company leave and absence workflows and the data specific to
those workflows. Shared employee and department master data remains owned by
Organization and is consumed through Organization contracts.

The current implemented capabilities are:

- an authenticated employee directory backed by Organization, with
  permission-controlled Organization administration actions;
- links to canonical Organization-owned employee and department Portal routes;
- authenticated Leave Type listing and details;
- permission-controlled Leave Type creation, update, activation, deactivation,
  and safe deletion of never-referenced types;
- atomic append-only audit records for successful Leave Type mutations,
  including deletion;
- database foundations for employee leave requests, status-transition history,
  and yearly leave balances.
- authenticated employee request creation, own list/detail, cancellation,
  active Leave Type options, and balance reads;
- Administrator request listing, detail/history, approval, rejection, and
  cancellation, protected by `vacation.requests.manage`;
- inclusive Business Calendar calculation and transactional balance use and
  restoration.
- employee Portal dashboard, request list, creation, details/history,
  cancellation, and personal calendar.
- permanent request identities, ledger evidentiary references to those
  identities, absent-operational-request posting rejection, permanent Leave
  Type dependency markers, and protection of five canonical system Leave Types;
- controlled administrative deletion of terminal, ledger-neutral leave
  requests through a dedicated permission, owner-controlled database function,
  atomic central audit, and Portal confirmation UX.

The approved target boundary for a future Leave Balance Ledger is documented
in [`../domain/vacation.md`](../domain/vacation.md) and
[`ADR-0005`](../adr/ADR-0005-leave-balance-ledger-boundaries.md). The ledger
remains an internal Vacation capability: Leave Policy supplies entitlement
inputs, Leave Request supplies persisted request quantities and workflow
causes, Business Calendar supplies working-day calculations, and Core Audit
supplies cross-platform audit evidence. None of those adjacent capabilities
owns or reconstructs the leave balance.

LV.2 is limited to append-only annual-entitlement, carry-over, manual-
adjustment, approved-request-consumption, and cancellation-reversal entries,
using the existing employee, Leave Type, and calendar-year dimensions. Current
balance and employee history derive from those entries. Categories, separate
entitlement periods, dual-control workflows, annual closing, buckets,
allocations, and generic extensibility are explicitly deferred. ADR-0005 and
[`ADR-0006`](../adr/ADR-0006-leave-balance-ledger-logical-persistence.md) are
normative. The LV.2 database and API foundation is implemented; ledger-only
cutover remains open. The existing mutable yearly balance is maintained as a
derived compatibility mirror until a separate cutover is approved.

Migration 020 adds the LV.2 append-only entry foundation. It records the
five approved entry kinds in the employee + Leave Type + calendar-year scope,
with non-negative balance enforcement and exact request-cancellation reversal
integrity. The administrator-only API posts annual entitlement, carry-over,
and reasoned manual-adjustment entries and reads the derived current balance
or ordered history for one employee, Leave Type, and leave year. It uses the
the Vacation-owned `vacation.leave-balances.manage` authorization policy, requires
an idempotent source reference, and atomically appends the required platform
audit event. The administrator Portal route `/vacation/admin/leave-balances`
selects one employee, balance-consuming Leave Type, and year; it displays the
derived current balance and acceptance-ordered history, and appends annual
entitlement, carry-over, or reasoned manual-adjustment entries. It reuses the
same `vacation.leave-balances.manage` permission and mirrors only input-shape
validation; API authorization and ledger invariants remain authoritative.
Annual-entitlement, carry-over, and manual-adjustment posting creates or
updates the matching `vacation.leave_balances` compatibility row in the same
service-owned transaction as the append-only entry and audit. Its three credit
buckets are recalculated from accepted entries with half-day precision, so a
duplicate idempotent source cannot double-apply the mirror.
Balance-consuming request approval posts one request-consumption entry using
the request's stored working-day quantity; cancelling an approved request posts
its exact linked reversal. The request transition, compatibility-mirror
used-day mutation,
ledger posting, request history, and platform audit commit together. Annual
closing, expiry, buckets, allocation, and ledger-only cutover remain excluded.

The Administrator Portal includes the request list and request details
workspace. Submitted requests can be approved, rejected, or cancelled;
approved requests can be cancelled. Each action requires confirmation and
refreshes the details and transition history after success. The shared
Business Calendar supplies Vacation working-day calculations; notifications
and configurable approval workflows are not implemented.

Migration 031 introduces `vacation.requests.manage` and assigns it to the
Administrator role. It protects only Vacation request administration (list,
detail, history, approval, rejection, and cancellation). Existing
Administrator access tokens must be refreshed after the migration to receive
the new permission claim. Employee self-service is unchanged. Leave Policy and
Leave Balance authorization is independently governed by
`vacation.leave-balances.manage`.

Migration 035 introduces `vacation.leave-balances.manage`, assigns it to the
existing Administrator role, and protects Leave Policy and Leave Balance
Ledger administration. Existing Administrator access tokens must be refreshed
or the user must sign in again after the migration to receive the new claim.
`identity.users.manage` alone does not grant access to these Vacation routes.

Controlled Administrator browser smoke validated authorized navigation,
localized direct-route denial and API `403` responses for an unauthorized user,
request fields, individual and combined filters, clearing, empty and safe
not-found states, desktop tables, mobile cards without horizontal overflow,
details and chronological history, light/dark appearance, and a clean browser
console. No internal bigint identifiers or transition controls were displayed.
Multi-page pagination and filter preservation across a page transition were
statically reviewed but not forced because the available safe fixture produced
only one matching row.

Administrator action smoke additionally validated that submitted requests show
approve, reject, and cancel; approved requests show only cancel; rejected and
cancelled requests show no actions; and each action requires confirmation.
Approval, rejection, submitted cancellation, and approved cancellation accepted
optional comments as documented and refreshed details, chronological history,
and list status. Permission denial and stable Problem Details were localized by
the Portal without exposing backend exception text, and the browser console
remained clean. The fast local API completed transitions before the loading
label could be captured; the disabled loading-state guard and the resulting
single-transition histories confirmed duplicate-submission protection. A
transient database connection reset during fixture creation displayed only the
safe localized generic error and succeeded on retry. No runtime correction was
required, and all smoke-created requests were left rejected or cancelled.

### Leave Type administration

Migration 032 completes canonical Leave Type administration. Create, update,
activate, and deactivate reuse `vacation.leave-types.manage`. Physical deletion
requires the dedicated `vacation.leave-types.delete` permission and is
restricted to permanently unreferenced records through the
owner-owned `SECURITY DEFINER` function
`vacation.delete_unreferenced_leave_type(uuid)`; the runtime role receives only
its `EXECUTE` grant plus the previously missing `requires_balance` column
`UPDATE`, never a table `DELETE`. A leave type referenced by a leave request,
yearly balance, or ledger entry returns the stable `409`
`leave_type_delete_conflict` Problem Details with controlled dependency labels.
The Portal opens the shared `DependencyInspector` dialog, populated from
`GET /api/v1/vacation/leave-types/{publicId}/dependencies`, instead of a
toast-only conflict notice. The inspector lists live blocking dependencies with
counts (request status breakdown, distinct balance employees, ledger entries),
offers navigation to Request Administration and Leave Balances when those
groups exist, offers deactivation when permitted, and never provides a
delete-anyway path. Ledger groups show an informational note without a
navigation button. Dependent Vacation data never cascades.

The stable code stays immutable after creation. `Requires Balance` and
`Counts Against Balance` are editable only while the leave type is unused and
are locked by a derived `isInUse` flag afterward. Deactivation is always
allowed, and historical records continue to resolve deactivated types.

Migrations 038–039 add owner-maintained permanent dependency markers behind the
controlled delete function and mark exactly the canonical seeded codes as system types. System
types cannot be physically deleted but may still be deactivated; `isSystem` is
read-only in the existing API/Portal model. Runtime grants cannot access marker
rows or set `is_system`. Physical Leave Type deletion now requires
`vacation.leave-types.delete`; system types return `leave_type_system_protected`.

The Portal route is migrated to the canonical administration foundation
(`AdministrationPageHeader` via the workspace shell, `AdministrationPageBody`,
`AdministrativeGridShell` with `fillViewport`, `AdministrativeGridToolbar`,
`GridPagination`, the shared side panel, and shared buttons and form controls).
Its grid columns are Code, Name, Counts Against Balance, Requires Balance,
Requires Approval, Active, and Actions; the details panel shows every business
field and the derived usage state; the edit panel shows lock hints where the
business rules prevent editing.

See [`../domain/vacation.md`](../domain/vacation.md) for detailed ownership,
domain rules, persistence, authorization, and current implementation behavior.

### ADR-0007 controlled administrative deletion

Migrations 036–041 establish permanent request identity, ledger evidentiary
references, permanent Leave Type dependency markers, system Leave Types,
dedicated delete permissions, and
`vacation.delete_neutralized_leave_request(uuid)`.

The completed application path is:

- `POST /api/v1/vacation/requests/{requestId}/delete` requires
  `vacation.requests.delete` and a reasoned body;
- one API transaction calls the controlled function, writes
  `vacation.request.delete` through `AuditWriter`, and commits;
- audit failure rolls back deletion;
- Leave Type physical delete uses `vacation.leave-types.delete`;
- Portal request details show Delete only for terminal requests when the actor
  has the delete permission, using shared `ConfirmDialog` and
  `PortalNotification`.

Ledger evidence, permanent identities, central audit history, and the
compatibility mirror remain unchanged. Cancellation remains a separate
command. A deleted operational request is recoverable only through PostgreSQL
point-in-time recovery.

### Administrative absence recording

Administrators with `vacation.requests.manage` can record an absence in the
existing request administration workspace. The request uses the same
`vacation.leave_requests` table with `source = ADMINISTRATIVE_ENTRY`; the
employee flow retains `EMPLOYEE_REQUEST`. Administrative records are persisted
as `APPROVED`, use the shared Business Calendar calculation, reuse the
existing balance/ledger consumption and cancellation reversal, and show
Recorded/Evidentirano without adding a status.

### Administrative absence controlled smoke fixture

Run `scripts/smoke/administrative-absence-entry.ps1` against fresh canonical
API and Portal services. Each run creates dedicated development-only fixtures
under a unique `ADMSMOKE-<UTC timestamp>` prefix and reports every retained
identifier. It validates direct approved recording, working-day persistence,
history, audit, balance consumption, exact cancellation reversal, duplicate
cancellation protection, non-balance recording, overlap and insufficient-
balance rollback, inactive references, and source filtering. Requests with
ledger or history references are retained rather than deleted; the script
cancels its balance request and deactivates its employee and Leave Types. Its
non-balance request remains approved only long enough for Portal inspection and
must then be cancelled through the supported request flow. Append-only ledger
and history rows must never be deleted directly.

### LV.2 controlled development-database smoke fixture

The configured remote PostgreSQL instance may be used only when explicitly
approved as the development target. All `LV2SMOKE-` records are development-
only fixtures. Run `scripts/smoke/lv2-request-ledger.ps1`
with documented `.env` settings; it creates retained records under a unique
`LV2SMOKE-<UTC timestamp>` prefix and reports their identifiers. Ledger entries
are append-only and must not be deleted. The script covers stored working days,
sufficient approval/consumption, cancellation/reversal, insufficient rollback,
single approval and cancellation history entries, duplicate transitions, and
a non-balance control. `-SkipCancellation` limits a
root-cause validation run to sufficient/insufficient approval when a separately
recorded cancellation defect must remain unchanged.

The sufficient request-derived INSERT is runtime verified after correcting its
missing SQL `CASE ... END`. It posts `request_consumption`, negates the stored
working-day quantity, uses the request's employee, Leave Type, start-date year,
and effective date, stores the internal request ID in `leave_request_id`, and
uses that ID's decimal text as `source_reference`. Approved cancellation now
looks up that exact `request_consumption`, stores its ID in
`reverses_entry_id`, and inserts one equal-and-opposite
`cancellation_reversal`; duplicate cancellation conflicts without another
reversal. Migration 020, its triggers, and runtime grants required no change.
Retained fixture ledger entries must not be cleaned up because deleting them
would violate the append-only ledger rule; their timestamp prefix is the
development-data boundary.
