# Organization Domain

## Purpose

Organization owns the small set of shared organizational master data needed across Internal Apps. It provides stable employee and department references to Vacation and future applications such as Assets, Fleet, Help Desk, Approvals, and Visitors.

## Current entities

| Entity | Ownership and use |
|---|---|
| Employee | Organization-owned employee identity for internal business workflows. The current model contains employee number, name, email, department, employment status, public ID, and timestamps. |
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
edits cover name, email, and department; status changes use explicit activate
and deactivate commands. There is no physical delete contract or runtime
delete privilege. Every successful mutation and its shared audit event commit
in one transaction. Repeating a state command for the current state returns
the current record without an update or a new audit event.

The employee list combines global search with server-side employee-number,
full-name, exact-department-public-ID, email, and active-status filters.
Employee number, name, department, email, and status sorts are fixed,
allowlisted contracts with deterministic tie-breakers.
