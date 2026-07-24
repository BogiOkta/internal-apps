# Vacation Module

Vacation owns company leave and absence workflows and the data specific to
those workflows. Shared employee and department master data remains owned by
Organization and is consumed through Organization contracts.

The current implemented capabilities are:

- an authenticated employee directory backed by Organization, with
  permission-controlled Organization administration actions;
- links to canonical Organization-owned employee and department Portal routes;
- authenticated Leave Type listing and details;
- permission-controlled Leave Type creation, update, activation, and
  deactivation;
- atomic append-only audit records for successful Leave Type mutations.
- database foundations for employee leave requests, status-transition history,
  and yearly leave balances.

Leave request and balance services, API routes, Portal workflows, public
holidays, and configurable approval workflows are not implemented.

See [`../domain/vacation.md`](../domain/vacation.md) for detailed ownership,
domain rules, persistence, authorization, and current implementation behavior.
