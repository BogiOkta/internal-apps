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

Public holidays, approval-step configuration, attachments, and notifications
are not part of the MVP database foundation.

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
year. Future application logic calculates and persists working days using
Monday through Friday only; public holidays are intentionally excluded.

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

## Current implementation

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

The server calculates inclusive Monday-to-Friday working days and never accepts
an employee, status, or working-day value in the create contract. Public
holidays are not supported. Requests must remain within one calendar year and
contain at least one working day. The database exclusion constraint remains the
final race-safe overlap protection for submitted and approved requests.

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

No Leave Request Portal workflow, public-holiday calendar, notification,
background job, manager hierarchy, configurable workflow, or physical delete
is implemented.
