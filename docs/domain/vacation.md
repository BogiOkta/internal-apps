# Vacation Domain

## Purpose

Vacation owns leave and absence workflows. It uses shared Organization employees and departments but does not own or duplicate that master data.

## Dependencies

Vacation consumes authenticated Organization read endpoints for employee and department information. Employee and Department are references in Vacation workflows; changes to organizational master data belong to Organization.

## Owned data

Future Vacation-owned entities include:

- leave types;
- leave requests;
- leave balances;
- public holidays;
- Vacation approval records.

These entities are documented domain boundaries, not implementations delivered by the current sprint.

## Current implementation

The Portal exposes a localized Vacation workspace with Overview and Employees sections. Employees is currently a read-only directory backed by Organization endpoints, with search, department filtering, sorting, refresh, and row selection. Create, edit, export, leave-management workflows, and configuration remain unavailable.
