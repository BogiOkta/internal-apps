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

The current database foundation includes:

- leave types.

Future Vacation-owned entities may include:

- leave requests;
- leave balances;
- public holidays;
- Vacation approval records.

No request or balance tables are introduced with the leave-type foundation.

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
calendar color when configured, active status, and display order.

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

Leave requests, leave balances, holidays, approval workflows, and other
configuration remain unavailable.
