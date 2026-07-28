# Vacation Module

Vacation owns company leave and absence workflows and the data specific to
those workflows. Shared employee and department master data remains owned by
Organization and is consumed through Organization contracts.

The current implemented capabilities are:

- an authenticated employee directory backed by Organization, with
  permission-controlled Organization administration actions;
- links to canonical Organization-owned employee and department Portal routes;
- authenticated Leave Type listing and details;
- permission-controlled Leave Type creation, update, activation, and
  deactivation;
- atomic append-only audit records for successful Leave Type mutations.
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
normative. The LV.2 database and API foundation is implemented; projections
and cutover remain open. The existing mutable yearly balance remains the
implemented baseline until a separate cutover is approved.

Migration 020 adds the LV.2 append-only entry foundation. It records the
five approved entry kinds in the employee + Leave Type + calendar-year scope,
with non-negative balance enforcement and exact request-cancellation reversal
integrity. The administrator-only API posts annual entitlement, carry-over,
and reasoned manual-adjustment entries and reads the derived current balance
or ordered history for one employee, Leave Type, and leave year. It uses the
existing temporary `identity.users.manage` authorization convention, requires
an idempotent source reference, and atomically appends the required platform
audit event. The administrator Portal route `/vacation/admin/leave-balances`
selects one employee, balance-consuming Leave Type, and year; it displays the
derived current balance and acceptance-ordered history, and appends annual
entitlement, carry-over, or reasoned manual-adjustment entries. It reuses the
temporary `identity.users.manage` permission and mirrors only input-shape
validation; API authorization and ledger invariants remain authoritative.
Balance-consuming request approval posts one request-consumption entry using
the request's stored working-day quantity; cancelling an approved request posts
its exact linked reversal. The request transition, legacy baseline mutation,
ledger posting, request history, and platform audit commit together. Annual
closing, expiry, buckets, allocation, and balance projection remain excluded.

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
the new permission claim. Employee self-service and the temporary
`identity.users.manage` authorization of Leave Policies and Leave Balances are
unchanged.

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

See [`../domain/vacation.md`](../domain/vacation.md) for detailed ownership,
domain rules, persistence, authorization, and current implementation behavior.

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
