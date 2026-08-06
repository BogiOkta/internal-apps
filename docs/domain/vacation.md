# Vacation Domain

## Purpose

Vacation owns leave and absence workflows. It uses shared Organization employees and departments but does not own or duplicate that master data.

## Dependencies

Vacation consumes authenticated Organization read endpoints for employee and department information. Employee and Department are references in Vacation workflows; changes to organizational master data belong to Organization.

Vacation navigation links to the canonical Organization employee and
department routes. Future Vacation workflows resolve the authenticated user's
employee through `GET /api/v1/me/employee`; they must never infer that
relationship from email or username.

## Owned data

Vacation owns data specific to leave management.

The database foundation includes:

- leave types;
- leave requests;
- leave request transition history;
- persisted yearly leave balances.
- annual leave policies.

Business Calendar data is shared Core Platform data and is not part of the
Vacation database foundation. Approval-step configuration, attachments, and
notifications are also excluded.

### Leave types

`vacation.leave_types` defines the categories later referenced by leave requests
and balance rules. Its code is a stable technical identifier used by
application logic and integrations; it is not user-editable reference text.
The runtime role can assign a code when creating a type but cannot change it
afterward. Corrections require a reviewed migration or an approved owner-level
administrative operation.

User-visible names and optional descriptions are stored in explicit Serbian
and English columns. This deliberately avoids a translation table or generic
lookup framework for a small, bounded reference list. Each type also records
whether it consumes annual vacation balance, whether approval is required, its
calendar color when configured, whether a balance record is required, active
status, and display order. The established
`counts_against_vacation_balance` column remains the canonical persisted name
for the locked counts-against-balance concept.

Inactive leave types remain valid references for historical records but cannot
be selected for new requests. Deactivation is always allowed and never breaks
historical resolution. Repository updates must explicitly set
`updated_at = now()`; no automatic timestamp trigger is used.

Migration 032 adds controlled physical deletion. Migrations 038–039 make usage
permanent through `vacation.leave_type_protected_dependencies` and protect the
five canonical system codes. A leave type may be deleted only when it has never
been referenced by `vacation.leave_requests`, `vacation.leave_balances`, or
`vacation.leave_balance_entries`, and when it is not a system type. Deletion runs
exclusively through the owner-owned `SECURITY DEFINER` function
`vacation.delete_unreferenced_leave_type(uuid)`; the runtime role holds no
`DELETE` privilege on `vacation.leave_types` and no direct SQL delete path
exists. This matches the Organization Department pattern established by
migration 030. A referenced leave type raises the internal
`leave_type_delete_conflict:v1:<controlled-label>(|<controlled-label>)*`
grammar, whose labels are `Vacation leave request`, `Vacation leave balance`,
and `Vacation leave balance entry`. The API translates only those controlled
labels into the stable `409` `leave_type_delete_conflict` Problem Details with a
`dependencies` array; the Portal shows a localized message explaining that the
leave type is already in use and should be deactivated instead. Dependent rows
are never cascaded or deleted.

Markers are backfilled and added by owner-controlled triggers, are never
removed, and are inaccessible to the runtime role. Existing Organization
employee markers already preserve the same permanent request dependency and
require no behavioral change. System types expose read-only `isSystem = true`,
may still be deactivated, and cannot have the flag set by the runtime.

`requires_balance` and `counts_against_vacation_balance` are editable only
while a leave type is unused. The list and details projections derive an
`isInUse` flag from the same three live referencing tables. Permanent markers
are consulted by the owner-controlled delete function. Once `isInUse` is true, the API
rejects a differing submitted value for either field with a locked-field
validation error, and the Portal renders lock hints instead of editable
controls. Migration 032 grants the runtime role the previously missing
`requires_balance` column `UPDATE`; the unused-only rule is enforced in the
application layer. The stable code remains immutable after creation and is not
part of the update contract.

Leave Type administration uses the explicit permission
`vacation.leave-types.manage`. The permission is seeded by migration 007 and
assigned initially only to the existing `Administrator` role. The stable code
is accepted only during creation and is not part of the update contract or the
runtime role's update privileges. Duplicate code comparison is
case-insensitive and produces a conflict response.

After migration 007 is applied, existing Administrator access tokens must be
refreshed or reissued before they contain the new permission claim.

### Leave requests

A request belongs to one Organization employee and exactly one leave type.
Dates are inclusive, date-only, ordered, and must remain within one calendar
year. Vacation delegates all working-day calculations to the shared Business
Calendar and persists its inclusive result. Vacation does not reinterpret
weekends or configured non-working dates.

The only statuses are `SUBMITTED`, `APPROVED`, `REJECTED`, and `CANCELLED`.
There is no draft and no physical-deletion capability. A permanent
`vacation.leave_request_identities` row owns each numeric ID and public UUID;
the operational request matches both through a composite foreign key. Creation
allocates the identity first in the same transaction. A single Administrator decision
actor is stored for approval or rejection. Cancellation remains in history.
Requests for the same employee cannot overlap while either request is submitted
or approved; rejected and cancelled requests do not block later dates.

Every status transition is appended to
`vacation.leave_request_history`. Platform audit events remain additionally
required when future services implement consequential writes.

Administrative absence recording reuses the same `vacation.leave_requests`
table. Its immutable `source` distinguishes `EMPLOYEE_REQUEST` from
`ADMINISTRATIVE_ENTRY`; it does not introduce another request status or an
absence table. An administrative entry is persisted directly as `APPROVED`.
Recorded/Evidentirano is Portal presentation only. The flow reuses the
employee/request note, request-management permission, ledger consumption, and
exact approved-cancellation reversal.

### Leave balances

`vacation.leave_balances` is a derived compatibility mirror for one employee,
leave type, and year; that combination is unique. Existing annual-entitlement,
carry-over, and manual-adjustment ledger commands recalculate the matching
credit columns from accepted `vacation.leave_balance_entries` in the same
service-owned transaction as the new entry and audit event. Request approval
and approved cancellation continue to update `used_days` transactionally while
posting consumption and exact reversal entries. Credit columns use half-day
precision so employee and ledger reads preserve the ledger quantity contract.

This mutable yearly balance remains a compatibility model, not the approved
source of truth for the Leave Balance Ledger. The target ownership,
responsibility boundaries, and invariants are defined by
[ADR-0005](../adr/ADR-0005-leave-balance-ledger-boundaries.md), and the logical
persistence model is defined by
[ADR-0006](../adr/ADR-0006-leave-balance-ledger-logical-persistence.md). No
ledger-only cutover has been approved.

### Leave policies

`vacation.leave_policies` represents the annual entitlement assigned to an
employee at the beginning of a leave year. One employee may have at most one
policy per leave year. A policy stores annual entitlement, carry-over and its
optional expiration date, a possibly negative manual adjustment, optional
notes, and timestamps.

Leave Policy is an entitlement-input model only. It contains no balance,
remaining, consumed, or used-day value, and this sprint does not derive or
store any calculated value. Policy-derived balance calculation, allocation
generation, automatic carry-over, and ledger integration remain separate
future work.

### Leave Balance Ledger LV.2 boundary

The following LV.2 statement is normative and supersedes the retained
historical target description in this section. LV.2 uses the existing employee,
Leave Type, and calendar-year balance key. It records immutable annual
entitlement, carry-over, manual adjustment, approved-request consumption, and
linked cancellation-reversal entries. Current balance is their signed sum and
employee balance history is their chronological view.

Categories, Leave Type mappings, separate entitlement periods, dual-control
adjustments, corrections, annual closing, expiration, buckets, allocations,
transaction headers, generic source infrastructure, and generic ledger
abstractions are deferred. The first vertical slice establishes entitlement and
carry-over credits; exposes current balance and history; posts consumption and
its cancellation reversal atomically with request transitions and audit; and
allows reasoned manual adjustments. ADR-0005 and ADR-0006 are canonical for
this reduced model.

Migration 020 implements the append-only
`vacation.leave_balance_entries` table. It enforces the employee + Leave Type
+ calendar-year scope, the five LV.2 kinds, signed half-day quantities,
idempotent source references, request consumption and exact cancellation
reversal links, and a non-negative derived balance. The runtime role may read
and insert entries but cannot update or delete them. Balance-consuming approval
posts one negative request-consumption entry from the request's persisted
working-day quantity, and cancellation of an approved request posts one exact,
linked positive reversal. The request row lock plus the ledger's scoped
transaction lock and unique business causes prevent duplicate posting and
concurrent negative ledger balances. Transition, compatibility-mirror
mutation, ledger entry, transition history, and platform audit commit
atomically; a ledger insufficiency rolls the transition back. Credit-side
ledger posting also creates or refreshes the matching `leave_balances` row and
derives each credit bucket from accepted entries, so idempotent replay cannot
double-apply the mirror. The compatibility mirror remains in place pending a
separately approved ledger-only cutover.

For request-derived entries, migration 020 stores the internal bigint request
key in `leave_request_id` and its decimal text in `source_reference`; the
public UUID remains the API identifier and is not stored in those cause
columns. `reverses_entry_id` is null for consumption and must identify the
exact original `request_consumption` for a reversal. The runtime cancellation
lookup uses that migration-defined kind, so the inserted positive reversal
exactly negates the original consumption. The request transition guard and
the unique reversal link prevent a duplicate cancellation from adding another
reversal.

The LV.2 API exposes administrator-only posting commands for annual
entitlement, carry-over, and reasoned manual adjustment, plus derived balance
and chronological history reads for one employee, Leave Type, and calendar
year. Posting requires a source reference for retry idempotency and is atomic
with its Vacation audit event. Leave Request itself posts consumption and
cancellation reversals internally; no public posting endpoint exists for either
request-derived entry kind.

The administrator Portal route `/vacation/admin/leave-balances` uses those
commands without deriving balances itself. An authorized administrator selects
an employee, balance-consuming Leave Type, and calendar year, loads the
derived balance and acceptance-ordered history, and can append entitlement,
carry-over, or reasoned manual-adjustment entries. It mirrors required IDs,
non-zero half-day quantity, positive credit quantities, effective-year, reason,
and source-reference checks only for prompt feedback; server validation,
authorization, idempotency, and non-negative balance enforcement remain
authoritative. Charts, exports, projections, annual closing, expiry, buckets,
and request workflow integration are not present.

### Superseded pre-LV.2 target description

The Leave Balance Ledger is a Vacation-owned capability. It is not a separate
module and is not shared Core infrastructure.

Its responsibility is to provide the authoritative, append-only explanation
of accepted balance effects, their traceable reversals, and the balance derived
from those effects. It owns leave-account sufficiency and reconciliation.
Derived balance views may support reads, but they cannot become an independent
source of truth.

The adjacent capability boundaries are:

- Organization owns employee and department master data, not entitlement or
  leave history.
- Leave Policy owns entitlement inputs, not usage or remaining balance.
- Leave Request owns request state and the persisted Business Calendar
  quantity. Approval and approved cancellation cause balance effects, but the
  request workflow does not independently own balance accounting.
- Business Calendar owns working-day rules and calculations, not entitlement,
  posting, reversal, or carry-over.
- Core Audit owns the cross-platform audit record, not balance reconstruction.
- The Vacation application layer coordinates request, ledger, and audit
  changes atomically.

The ledger's core business invariants are:

- every accepted effect is attributable to one resolved leave account, an
  employee, applicable period and balance category, a signed quantity, a
  business source, an effective business date, an actor or system origin, and
  a reason; credits increase and debits decrease the balance;
- accepted effects are append-only; correction and cancellation use a
  traceable equal-and-opposite reversal and, when needed, a new corrected
  effect rather than mutation or deletion;
- one business cause produces at most one effective posting, including under
  retry;
- authoritative balance is the algebraic result of applicable effects, and
  every projection must be reconcilable to them;
- approval of a balance-consuming request posts its persisted working-day
  quantity exactly once, and approved cancellation reverses exactly that
  effect; other request states do not consume balance;
- approval, its balance effect, and Core Audit succeed or fail together, and
  concurrent approvals cannot make the effective balance negative;
- later Business Calendar changes never recalculate an existing request's
  persisted quantity or its balance effect;
- inactive master or reference records remain attributable in history; and
- ledger history, request transition history, and Core Audit remain distinct
  but correlatable records.

Leave Policy must not store calculated balance, Leave Request must not become a
second ledger, Business Calendar must not decide balance rules, Core Audit must
not be used to reconstruct a balance, and the Portal must not authoritatively
calculate or mutate balance. No other module or repository may write the
Vacation ledger directly. A generic Core ledger is prohibited unless a second
domain-neutral use case and a separate architecture decision justify it.

ADR-0005 finalizes the ledger business rules. In summary:

- an account is employee, balance category, and calendar-year entitlement
  period; balance-consuming Leave Types map prospectively to one category;
- opening entitlement, carry-over, consumption, expiration, manual
  adjustment, reversal, and closing transfer are the only effect types;
- quantities are working days in whole or half-day increments; hours and
  smaller fractions are unsupported;
- carry-over is capped, reaches only the next period, does not compound,
  expires on a configured date, and is consumed before current entitlement;
- balances cannot be negative and no role can override sufficiency;
- manual adjustments use fixed exceptional reasons, an open period, factual
  explanation, and proposer/independent-approver segregation of duties;
- reversal cancels a whole accepted effect, while correction reverses it and
  posts the corrected effect;
- annual closing is reconciled, atomic, idempotent, and final; and
- later master-data, policy, calendar, permission, or status changes never
  rewrite accepted history.

The complete rationale, owner capability, and fixed-versus-configurable
classification for every rule are normative in ADR-0005. The approved logical
persistence model is normative in
[ADR-0006](../adr/ADR-0006-leave-balance-ledger-logical-persistence.md). It
defines categories, periods, mappings, employee/category/period accounts,
dual-control adjustment authorizations, immutable transactions and entries,
opening and carry-over buckets, debit allocations, typed source correlation,
reversal/correction relationships, annual closings, public identifiers, and
logical constraints.

Entries are authoritative; accounts store no authoritative entitlement, used,
or remaining total. Buckets exist only for opening entitlement and carry-over
to preserve expiry, priority, non-compounding, closing eligibility, and exact
reversal. Initial policy values, physical design, indexes, concurrency,
projections, SQL, migrations, APIs, application code, and cutover remain open.

## Current implementation

Administrators may list, retrieve, create, update, and delete annual Leave
Policies through `/api/v1/vacation/leave-policies`. The list filters by leave
year and employee and sorts by employee name. The unique employee/year
constraint is enforced by PostgreSQL and returned as stable Problem Details.
Administration requires `vacation.leave-balances.manage` and every successful
write is audited atomically.

The minimal administrator Portal route `/vacation/admin/policies` provides
employee and year selectors, a compact entitlement form, and create, edit, and
confirmed delete actions. It does not calculate or display a balance and
contains no dashboard, chart, report, import, or export.

The Portal exposes a localized Vacation workspace with Overview, Employees,
and Leave Types sections. Employees is currently a read-only directory backed
by Organization endpoints, with server-side search and column filtering,
sorting, export, and row selection. Organization administrators may manage
the same Organization records from this workspace; Vacation does not own them.

The Leave Types workspace retains its compact table and right-side panel. All
authenticated users can read Leave Types through:

- `GET /api/v1/vacation/leave-types`;
- `GET /api/v1/vacation/leave-types/{publicId}`.

No dedicated Vacation read permission exists yet, so reads follow the same
authentication-only rule as the current Organization directory.

The list supports case-insensitive search, `active`/`inactive`/`all` status
filtering, and allowlisted sorting by display order, code, localized name, or
status in ascending or descending direction. `Accept-Language` selects Serbian
or English names and descriptions; missing or unsupported languages fall back
to Serbian, while a missing localized description remains null.

Users with `vacation.leave-types.manage` can create and edit Leave Types in the
same side panel, can explicitly activate or deactivate a selected type, and can
delete a never-referenced type through
`DELETE /api/v1/vacation/leave-types/{publicId}`. Activation commands are
state-idempotent. The Portal hides these controls for other users, while the API
policy remains authoritative. Every successful mutation, including deletion,
updates `updated_at` where applicable and writes an append-only audit event in
the same database transaction.

The Leave Types Portal route uses the canonical administration foundation:
`AdministrationPageHeader` through the workspace shell,
`AdministrationPageBody`, `AdministrativeGridShell` with `fillViewport`,
`AdministrativeGridToolbar`, `GridPagination`, the shared side panel, and the
shared button and form-control helpers. Its grid columns are Code, Name, Counts
Against Balance, Requires Balance, Requires Approval, Active, and Actions. The
details panel shows all business fields plus the derived usage state, and the
edit panel renders lock hints for the immutable code and for locked balance
behaviour.

### Leave request application layer

Authenticated employee self-service under `/api/v1/vacation/me` lists active
Leave Types, own requests and balances, creates requests, and cancels eligible
own requests. The current employee is resolved only through the explicit
Identity User–Organization Employee link. An unlinked user receives
`current_user_employee_not_linked`; an inactive employee cannot use
self-service.

The server obtains inclusive working days from Business Calendar and never
accepts an employee, status, or working-day value in the create contract.
Requests must remain within one calendar year and contain at least one working
day. The persisted Business Calendar result is the value used by later balance
deduction and restoration. The database exclusion constraint remains the final
race-safe overlap protection for submitted and approved requests.

Administrator operations require the dedicated
`vacation.requests.manage` permission, without username or role-name checks.
Leave Policies and Leave Balances use `vacation.leave-balances.manage`.
Approval locks the request and any required employee/Leave Type/year balance.
It increments `used_days` only when sufficient balance exists. Cancelling an
approved request reverses that use; cancelling a submitted request and
rejecting a request do not affect balance.

Creation writes `NULL -> SUBMITTED` history. Every transition writes the
request, optional balance mutation, append-only history, and platform audit on
one connection and transaction. Failed validation, lookup, conflict, or
transition attempts write no successful history or audit record.

The permission-aware Administrator Portal uses
`/vacation/admin/requests` for the paginated request workspace and
`/vacation/admin/requests/{requestId}` for details and history.
The list uses the canonical administration shell with server-backed status,
Leave Type, source, employee text, and year filters and `GridPagination`.
Submitted requests expose approval, rejection, and administrator cancellation
on the details route; approved requests expose administrator cancellation;
terminal requests expose no transition actions.

The ledger evidentiary request foreign key targets the permanent identity with
restrictive delete behavior. New request-derived entries still require an
operational request: the integrity trigger rejects absence explicitly and uses
null-safe comparisons while preserving scope, quantity, status, reversal, and
balance rules. No accepted ledger row was changed by this foundation.

No Vacation-owned public-holiday calendar, notification, background job,
manager hierarchy, configurable workflow, or request delete is implemented.

### Employee Portal

The employee Portal uses `/vacation` as the operational dashboard,
`/vacation/requests` for the complete own-request list,
`/vacation/requests/new` for creation, and
`/vacation/requests/{requestId}` for details, history, and eligible
cancellation.

The form mirrors date-order, same-year, and note-length rules for immediate
feedback. Its working-day preview calls the authenticated shared Business
Calendar range endpoint; no working-day rules are implemented in the Portal,
and the value is never submitted. Vacation request creation calls the same
Business Calendar service directly and remains authoritative. Balance guidance
uses the matching persisted Leave Type/year balance and does not invent a
balance for non-balance Leave Types.

Calendar events are generic `AppCalendar` events. Because Vacation API ranges
are inclusive and FullCalendar all-day ends are exclusive, the adapter adds
one calendar day to `dateTo` without changing the API value. Unlinked accounts
receive a dedicated state directing the user to an administrator.
