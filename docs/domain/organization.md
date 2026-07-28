# Organization Domain

## Purpose

Organization owns the small set of shared organizational master data needed across Internal Apps. It provides stable employee and department references to Vacation and future applications such as Assets, Fleet, Help Desk, Approvals, and Visitors.

## Current entities

| Entity | Ownership and use |
|---|---|
| Employee | Organization-owned employee identity for internal business workflows. The current model contains an immutable employee number; first, optional middle, and last names; optional email; optional employment start and end dates; department; explicit employment status; public ID; and timestamps. |
| Department | Organization-owned organizational unit with code, name, active status, public ID, and timestamps. |

Employees belong to departments inside the Organization domain. Consumers read Organization data through Organization API contracts and do not update its tables directly. Numeric database IDs remain internal.

## Current boundary

Organization is shared business master data, not a full HR system. The following are explicitly out of scope:

- payroll and compensation;
- recruitment and onboarding;
- performance management;
- employee documents;
- positions, offices, and cost centers;
- manager hierarchy until a concrete workflow requires it.

Migration 004 historically created the current tables in `vacation`. Migration 005 moves those same table objects and rows to `organization`; the final database location defines current ownership.

## Employee administration

Employee is an Organization business-person record and is distinct from an
Identity user account. Creating an employee does not provision a user.

Authenticated users retain read access to the directory. Creation, editing,
activation, and deactivation require `organization.employees.manage`, seeded
by migration 008 only to the existing `Administrator` role. Existing
Administrator tokens must be refreshed or reissued after that migration.

Employee number is supplied on creation and is immutable thereafter. Normal
edits cover name, optional email, optional employment dates, and department;
status changes use explicit activate and deactivate commands. Controlled
physical deletion is limited to administrators and employees with no
dependencies. Every successful mutation and its shared audit event commit in
one transaction. Repeating a state command for the current state returns the
current record without an update or a new audit event.

The employee list combines global search with server-side employee-number,
full-name, exact-department-public-ID, email, and active-status filters.
Administrators may delete only an unreferenced employee. The API checks links,
Vacation history, audit targets, and future employee-related records through a
central permanent database marker; it never cascades or deletes history. A
dependency returns `409 employee_delete_conflict`, and the employee must be
deactivated instead.

Migration 024 revokes direct `DELETE` on `organization.employees` from the
runtime role. The API can request physical deletion only through the
owner-controlled `organization.delete_unreferenced_employee(uuid)` function.
That function locks the employee, checks the permanent marker, and deletes only
the employee row. Explicit employee foreign keys provide defense in depth, and
any foreign-key conflict is converted to the same deterministic
`employee_delete_conflict`.

Migration 025 permanently records the first protected dependency for each
employee. Migration 026 forward-upgrades that already-journaled marker to keep
declaratively configured dependency names, migration 027 forward-upgrades the
controlled function to return those names, migration 028 replaces the
PostgreSQL detail transport with the versioned internal
`employee_delete_conflict:v1:<label>(|<label>)*` message token. The API parses
only that controlled grammar and exposes only its fixed allowlist of business
labels; missing, malformed, redacted, or unknown values produce the safe
generic conflict response. Migration 029 retains the exact legacy stored
sentinel `Protected employee dependency`, but omits it from the token when one
or more specific labels exist. If it is the only marker, the function emits
the legacy generic conflict; any other unknown marker remains in the complete
token so the API rejects the whole token rather than exposing a partial list.
Removing a link or another independently managed
mutable reference does not make that employee deletable later. Runtime roles
have no access to the marker table, and the marker's own employee foreign key
is `NO ACTION`. The shared trigger function records the configured dependency
name without a module-specific application-code mapping.

Every new employee-related table is incomplete unless its focused migration:

1. creates the normal foreign key to `organization.employees` with explicit
   `ON DELETE NO ACTION` or `ON DELETE RESTRICT`;
2. attaches `organization.remember_employee_protected_dependency()` using the
   employee-reference column, reference kind, and a concise user-facing
   dependency name as trigger arguments; and
3. tests both the foreign key and trigger attachment.

No employee-related foreign key may use `ON DELETE CASCADE`. Employee deletion
must never clean up dependent rows. This extension procedure requires no API,
C#, employee-service, or Portal code change.

Employee number, name, department, email, and status sorts are fixed,
allowlisted contracts with deterministic tie-breakers. When the Employee list
omits `sort`, the API orders Active employees first, then inactive employees;
within each status group it applies natural ascending employee-number ordering
(`2` before `10`, `EMP-2` before `EMP-10`). An explicit `sort` continues to
override this default.

`employment_status` is the sole authoritative active/inactive state. An
employment end date is historical information only and does not deactivate an
employee; inactive employees, including those with no end date, remain
queryable for historical use. Optional email addresses are unique
case-insensitively when present. When both employment dates are supplied, the
end date cannot precede the start date.

## Department administration

Department administration follows the Employee administration pattern.
Creation, editing, activation, deactivation, and controlled deletion require
`organization.departments.manage`, seeded by migration 030 only to the
existing `Administrator` role. Existing Administrator tokens must be
refreshed or reissued after that migration.

Department code is supplied on creation and is immutable thereafter, mirroring
employee number. Name is editable; status changes use explicit activate and
deactivate commands. `GET /api/v1/organization/departments` accepts an
optional `status` filter (`active`, `inactive`, `all`); an omitted value
preserves the pre-administration contract and returns only active
departments, so the existing employee directory and employee-creation
dropdown are unaffected. Department code, name, and status sorts are fixed,
allowlisted contracts with deterministic tie-breakers, matching the employee
list. Repeating a state command for the current state returns the current
record without an update or a new audit event.

Administrators may delete only an unreferenced department. Departments have a
single same-module dependency, `organization.employees.department_id`, so the
owner-controlled `organization.delete_unreferenced_department(uuid)` function
checks that dependency directly instead of using the cross-schema permanent
marker mechanism built for employee deletion; that mechanism exists because
employee dependents span multiple module schemas that Organization does not
own, which is not the case for departments. A dependency returns `409
department_delete_conflict` with the versioned internal
`department_delete_conflict:v1:Organization employee` message token; the API
parses only that controlled grammar and exposes only its fixed allowlist of
business labels, matching the employee delete-conflict contract. The
department must be deactivated instead. The employee-to-department foreign key
remains `ON DELETE NO ACTION`, unchanged by this migration.

Every successful mutation and its shared audit event commit in one
transaction. Every create, update, activate, deactivate, and delete produces
an `organization.departments.*` audit event with `department` as the target
type.

## User–employee relationship

Identity owns users and Organization owns employees. Core owns the optional
one-to-one relationship in `core.user_employee_links`: one user and one
employee can each appear in at most one current link. The relationship stores
internal foreign keys but is managed through public UUIDs. It is never inferred
from username, email, employee number, or display names, and employee creation
does not create or link a user.

Conversely, Identity user creation does not create or link an employee.
Administrators create an ordinary account at the canonical `/identity/users`
Portal route, then explicitly link it through
`/organization/user-employee-links`.

Management requires `organization.user-employee-links.manage`. New or changed
links require an active Identity user and active Organization employee;
existing links to records that later become inactive remain readable. Create,
change, and explicit unlink operations are audited in the same transaction.
After migration 009, Administrator tokens require refresh or reissue.

`GET /api/v1/me/employee` is authenticated-only and resolves the current
user's employee exclusively through the explicit link. An unlinked user
receives `404` with `current_user_employee_not_linked`.

Canonical Portal routes are `/organization/employees`,
`/organization/departments`, and `/organization/user-employee-links`.
Vacation may link to these shared pages, but navigation placement does not
change domain ownership. Legacy Vacation employee and department URLs redirect
to the canonical routes.

Employee create and update accept only active departments. Employees already
assigned to a department that later becomes inactive remain readable and are
not silently reassigned.

## Development Okta employee seed

`scripts/development/seed-okta-organization-employees.ps1` is the repeatable,
development-only reconciler for the approved Okta employee dataset. It reads
the owner connection settings from `.env`, ensures the active
`NERASPOREDJENI` / `Neraspoređeni` department, and reconciles the 29 supplied
employees by immutable `employee_number`. It sets imported email values to
null and makes the supplied employment status, names, dates, and department
authoritative on every run.

Run it only against the explicitly approved development database. In addition
to the confirmation switch, `APPROVED_DEVELOPMENT_DB_NAME` must exactly match
the configured `DB_NAME`:

```powershell
pwsh -File scripts/development/seed-okta-organization-employees.ps1 `
    -ConfirmDevelopmentDatabase
```

The reset is intentionally narrow. Employee number `1` is excluded from the
authoritative set and is removed only when unreferenced. Employee `123` is the
canonical Vladimir Ljubiša Bogićević record and its Identity link is retained.
Only the ten obsolete migration-004
`EMP-0001` through `EMP-0010` development seed rows are candidates for
removal; unrelated employees are never selected. Candidates with a permanent
protected dependency marker, user links, leave requests, legacy balances,
leave policies, append-only LV2 ledger entries, or audit targets are preserved
and reported with their reasons. Ledger and history records are never deleted.
The script reports inserted, updated, skipped, removed, and preserved employee
numbers, and is safe to rerun. It refuses to connect unless the operator
explicitly supplies the development-database confirmation switch.
