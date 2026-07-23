# Vacation Domain

## Purpose

Vacation owns leave and absence workflows. It uses shared Organization employees and departments but does not own or duplicate that master data.

## Dependencies

Vacation consumes authenticated Organization read endpoints for employee and department information. Employee and Department are references in Vacation workflows; changes to organizational master data belong to Organization.

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

## Current implementation

The Portal exposes a localized Vacation workspace with Overview, Employees,
and Leave Types sections. Employees is currently a read-only directory backed
by Organization endpoints, with search, department filtering, sorting,
refresh, and row selection.

The Leave Types workspace page provides a read-only table and detail panel
backed by:

- `GET /api/v1/vacation/leave-types`;
- `GET /api/v1/vacation/leave-types/{publicId}`.

Both routes require an authenticated user. No dedicated Vacation read
permission exists yet, so the module follows the same authentication-only rule
as the current Organization directory rather than inventing a permission.

The list supports case-insensitive search, `active`/`inactive`/`all` status
filtering, and allowlisted sorting by display order, code, localized name, or
status in ascending or descending direction. `Accept-Language` selects Serbian
or English names and descriptions; missing or unsupported languages fall back
to Serbian, while a missing localized description remains null.

There are no Leave Type create, edit, delete, activation, or deactivation
operations. Leave requests, leave balances, holidays, approval workflows, and
other configuration remain unavailable.
