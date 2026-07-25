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
- authenticated employee request creation, own list/detail, cancellation,
  active Leave Type options, and balance reads;
- Administrator request listing, detail/history, approval, rejection, and
  cancellation;
- inclusive Monday-to-Friday calculation and transactional balance use and
  restoration.
- employee Portal dashboard, request list, creation, details/history,
  cancellation, and personal calendar.

The Administrator Portal includes a read-only request list and request details
workspace. Approval, rejection, and administrator cancellation Portal
workflows, public holidays, notifications, and configurable approval workflows
are not implemented.

Controlled Administrator browser smoke validated authorized navigation,
localized direct-route denial and API `403` responses for an unauthorized user,
request fields, individual and combined filters, clearing, empty and safe
not-found states, desktop tables, mobile cards without horizontal overflow,
details and chronological history, light/dark appearance, and a clean browser
console. No internal bigint identifiers or transition controls were displayed.
Multi-page pagination and filter preservation across a page transition were
statically reviewed but not forced because the available safe fixture produced
only one matching row.

See [`../domain/vacation.md`](../domain/vacation.md) for detailed ownership,
domain rules, persistence, authorization, and current implementation behavior.
