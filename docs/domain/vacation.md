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

The Portal exposes a localized Vacation workspace with Overview and Employees
sections. Employees is currently a read-only directory backed by Organization
endpoints, with search, department filtering, sorting, refresh, and row
selection.

The database contains the initial Vacation-owned leave-type reference data.
There is no leave-type API or Portal management UI yet. Create, edit, export,
leave requests, leave balances, holidays, approval workflows, and configuration
remain unavailable.
