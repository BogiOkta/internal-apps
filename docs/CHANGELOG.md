# Internal Apps Platform change history

## 2026-07-24 — Sprint 05B Vacation domain and database foundation validated

- Added and applied migrations 012–017 for the missing Leave Type balance
  requirement, employee leave requests, append-only status-transition history,
  persisted yearly balances, idempotent MVP Leave Type reconciliation, and
  least-privilege runtime grants.
- Enforced the four-state request model, single-year date ranges, positive
  working-day storage, single decision/cancellation actors, and race-safe
  overlap prevention for submitted and approved requests.
- Added no services, repositories, endpoints, Portal behavior, notifications,
  holidays, or configurable workflow infrastructure.
- Validated the resulting PostgreSQL schema and runtime privileges through
  catalog checks and a transaction-rolled-back database smoke covering valid
  writes, constraints, overlap rules, status metadata, restrictive foreign
  keys, history immutability, and cleanup. No smoke scenario was skipped and
  no smoke record remained.

## 2026-07-24 — Sprint 05A.1 platform appearance and date ranges

- Moved Light/Dark/System appearance ownership into the Portal shell with
  persisted selection and pre-hydration theme initialization.
- Made the calendar demo discoverable through permission-aware development
  navigation and removed page-local appearance state.
- Added the shared, controlled `DateRangePicker` with localized boundaries,
  responsive one/two-month layouts, disabled and bounded dates, clearing, and
  a consumer-owned summary slot. No Vacation business rules were added.
- Validated the combined Sprint 05A/05A.1 Portal with a production build,
  strict TypeScript, repository whitespace checks, and browser coverage for
  appearance persistence, navigation, calendar states, range editing,
  clearing, localization, responsiveness, and console errors.

## 2026-07-24 — Sprint 05A shared calendar foundation

- Added the shared, domain-neutral `AppCalendar` component with month, week,
  day, and agenda views, localized navigation, generic event resources and
  callbacks, configurable status colors, loading and empty states, responsive
  layout, and light/dark appearance support.
- Added the mock-only `/demo/calendar` page for interactive component review.
- Adopted the approved FullCalendar React packages for the shared calendar
  foundation; no Vacation business behavior or backend integration was added.

## 2026-07-24 — Sprint 04B/04C validated

- Completed explicit optional one-to-one Identity User ↔ Organization Employee
  linking through `core.user_employee_links`, with audited create, change, and
  unlink operations.
- Established canonical Portal routes `/organization/employees`,
  `/organization/departments`, and `/organization/user-employee-links`; legacy
  Vacation employee and department routes redirect to Organization.
- Added authenticated `GET /api/v1/me/employee` resolution through the explicit
  link only.
- Added canonical `/identity/users` minimal administration for creating,
  activating, and deactivating ordinary accounts. Creation assigns only the
  fixed base `User` role; self-deactivation is rejected.
- Applied migrations 009–011 locally, including the fixed-role
  `identity.assign_base_user_role(...)` hardening.
- Validated the complete controlled Sprint 04B/04C smoke flow. The duplicate
  employee-link conflict check was skipped because no second active unlinked
  user was available, which is an accepted fixture prerequisite. The configured
  basic user finished active and linked.
