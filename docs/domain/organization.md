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
