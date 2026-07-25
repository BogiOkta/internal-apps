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

The Administrator Portal includes the request list and request details
workspace. Submitted requests can be approved, rejected, or cancelled;
approved requests can be cancelled. Each action requires confirmation and
refreshes the details and transition history after success. Public holidays,
notifications, and configurable approval workflows are not implemented.

Controlled Administrator browser smoke validated authorized navigation,
localized direct-route denial and API `403` responses for an unauthorized user,
request fields, individual and combined filters, clearing, empty and safe
not-found states, desktop tables, mobile cards without horizontal overflow,
details and chronological history, light/dark appearance, and a clean browser
console. No internal bigint identifiers or transition controls were displayed.
Multi-page pagination and filter preservation across a page transition were
statically reviewed but not forced because the available safe fixture produced
only one matching row.

Administrator action smoke additionally validated that submitted requests show
approve, reject, and cancel; approved requests show only cancel; rejected and
cancelled requests show no actions; and each action requires confirmation.
Approval, rejection, submitted cancellation, and approved cancellation accepted
optional comments as documented and refreshed details, chronological history,
and list status. Permission denial and stable Problem Details were localized by
the Portal without exposing backend exception text, and the browser console
remained clean. The fast local API completed transitions before the loading
label could be captured; the disabled loading-state guard and the resulting
single-transition histories confirmed duplicate-submission protection. A
transient database connection reset during fixture creation displayed only the
safe localized generic error and succeeded on retry. No runtime correction was
required, and all smoke-created requests were left rejected or cancelled.

See [`../domain/vacation.md`](../domain/vacation.md) for detailed ownership,
domain rules, persistence, authorization, and current implementation behavior.
