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
be selected for new requests. Initial lifecycle management uses `is_active`;
physical deletion is not part of the initial application behavior.
Future repository updates must explicitly set `updated_at = now()`; no
automatic timestamp trigger is used.

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
There is no draft and no physical deletion. A single Administrator decision
actor is stored for approval or rejection. Cancellation remains in history.
Requests for the same employee cannot overlap while either request is submitted
or approved; rejected and cancelled requests do not block later dates.

Every status transition is appended to
`vacation.leave_request_history`. Platform audit events remain additionally
required when future services implement consequential writes.

### Leave balances

`vacation.leave_balances` persists entitlement, carry-over, adjustment, and
used days for one employee, leave type, and year. That combination is unique.
`used_days` changes only through future transactional Vacation business logic.

### Leave policies

`vacation.leave_policies` represents the annual entitlement assigned to an
employee at the beginning of a leave year. One employee may have at most one
policy per leave year. A policy stores annual entitlement, carry-over and its
optional expiration date, a possibly negative manual adjustment, optional
notes, and timestamps.

Leave Policy is an entitlement-input model only. It contains no balance,
remaining, consumed, or used-day value, and this sprint does not derive or
store any calculated value. Balance calculation, allocation generation,
automatic carry-over, and request deduction will be introduced separately.

## Current implementation

Administrators may list, retrieve, create, update, and delete annual Leave
Policies through `/api/v1/vacation/leave-policies`. The list filters by leave
year and employee and sorts by employee name. The unique employee/year
constraint is enforced by PostgreSQL and returned as stable Problem Details.
Administration temporarily reuses `identity.users.manage` and every successful
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
same side panel and can explicitly activate or deactivate a selected type.
Activation commands are state-idempotent. The Portal hides these controls for
other users, while the API policy remains authoritative. Every successful
mutation updates `updated_at` and writes an append-only audit event in the same
database transaction. No physical deletion operation exists.

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

Administrator operations temporarily reuse the existing Administrator-only
platform permission `identity.users.manage`, without username or role-name
checks, until a dedicated Vacation request-management permission is approved.
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
`/vacation/admin/requests/{requestId}` for read-only details and history.
It supports server-backed status, Leave Type, employee text, and year filters,
with a responsive table/card presentation. No approval, rejection, or
administrator cancellation controls are exposed.

No Administrator transition Portal, public-holiday calendar, notification,
background job, manager hierarchy, configurable workflow, or physical delete
is implemented.

### Employee Portal

The employee Portal uses `/vacation` as the operational dashboard,
`/vacation/requests` for the complete own-request list,
`/vacation/requests/new` for creation, and
`/vacation/requests/{requestId}` for details, history, and eligible
cancellation. Sprint 05D adds no Administrator approval screens.

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
