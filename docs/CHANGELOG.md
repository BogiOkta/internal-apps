# Internal Apps Platform change history

## 2026-07-25 — Sprint BC.3 Business Calendar administration UI

- Added the permission-aware
  `/business-calendar/admin/non-working-days` Portal route and authorized
  administration navigation entry.
- Added localized ascending date list, current-year default and simple year
  filter, create/edit form, confirmed delete, validation, duplicate-date
  feedback, duplicate-submission protection, and refreshed loading, empty,
  success, forbidden, and safe error states.
- Added one centralized Business Calendar Portal service and focused contract
  tests for routes, methods, payloads, permission guarding, required fields,
  and absence of unsupported controls.
- Controlled smoke corrected the administrator list runtime mapping from
  PostgreSQL `timestamptz` values to the unchanged `DateTimeOffset` API
  contract. Authorized year loading, edit, confirmed delete, refresh,
  localized forbidden behavior, API authorization, safe errors, and a clean
  console were then validated; temporary smoke data was removed.
- Kept month calendars, recurrence, drag and drop, working Saturdays,
  collective vacations, regions/countries, import/export, bulk entry, and
  dashboard widgets intentionally excluded.

## 2026-07-25 — Sprint BC.2 Vacation integration

- Replaced Vacation's Monday-to-Friday request calculator with the shared
  Business Calendar service. Created requests persist its inclusive result,
  including configured non-working dates.
- Kept balance behavior transactional and unchanged in shape: approval deducts,
  and approved cancellation restores, the persisted Business Calendar result.
- Replaced the request form's local weekday estimate with the existing
  authenticated Business Calendar range endpoint. No new endpoint,
  administration UI, or RBAC change was added.
- Removed the duplicated backend calculator, its obsolete tests, and the
  Portal weekday-count helper. Added focused shared-calendar and Vacation
  integration tests, including balance-use and duplication guards.
- Validated API Release build, 15/15 API tests, Portal production build, strict
  TypeScript, and repository diff checks. Administrator browser smoke was not
  run, as required for this sprint.

## 2026-07-25 — Sprint BC.1 Serbian non-working days backend

- Added `core.non_working_days` for administrator-entered official
  non-working dates in the Republic of Serbia, with unique dates, Identity
  audit-user references, least-privilege grants, and atomic platform audit.
- Added authenticated working-day check and inclusive range-count operations;
  Saturdays, Sundays, and configured dates are non-working, and weekend
  holidays are not double-counted.
- Added minimal administrator list/get/create/update/delete endpoints using
  the temporary `identity.users.manage` permission and safe Problem Details.
- Kept the capability deliberately Serbia-only and explicit-date-only: no
  working Saturdays, collective vacations, recurrence engine, regional or
  multi-calendar abstractions, cache, background job, UI, or Vacation
  integration was introduced.
- Added focused automated service, validation, and migration-contract tests.

## 2026-07-25 — Sprint DEV.3 project-specific development ports

- Assigned stable local-development URLs to the Portal
  (`http://localhost:3100`) and API (`http://localhost:5100`) to avoid
  collisions with other locally developed applications.
- Added the canonical `DEV_PORTAL_PORT` and `DEV_API_PORT` local settings. The
  runner derives listening URLs, Portal API configuration, CORS, lifecycle
  checks, and smoke defaults from them; the API launch profile is only an IDE
  fallback.
- Consolidated Portal API base URL resolution into one shared module without
  changing production/runtime behavior.

## 2026-07-25 — Sprint DEV.1 minimal developer runner

- Added the repository-root `internal.ps1` entry point with only `start`,
  `stop`, `restart`, and `status` commands.
- The runner reuses responsive services, refuses unknown or unresponsive port
  occupants, starts the canonical API and Portal development commands in
  visible PowerShell windows, and verifies their HTTP endpoints.
- Stop targets only process trees whose PID and start time match
  repository-local state under the ignored `.internal/` directory. Stale
  process state is reported and skipped safely.

## 2026-07-25 — Sprint 05E.2 Vacation Administrator actions

- Added permission-aware approval, rejection, and administrator cancellation
  controls to Vacation Administrator request details.
- Matched backend transitions: submitted requests may be approved, rejected,
  or cancelled; approved requests may be cancelled; terminal requests expose
  no actions.
- Added explicit localized confirmations, optional administrator comments,
  duplicate-submission protection, loading states, success/error feedback, and
  post-transition details/history refresh through the typed Vacation service.
- Reused `identity.users.manage`; no backend, database, migration, dependency,
  or component-level fetch changes were introduced.
- Controlled browser smoke validated submitted/approved/terminal action
  visibility, every confirmation, optional comments, approval, rejection,
  submitted and approved cancellation, refreshed details/history/list status,
  localized safe Problem Details presentation, permission denial, and a clean
  console. The loading label could not be captured against the fast local API;
  duplicate-submission prevention was confirmed by the disabled-state
  implementation and successful single-transition histories. A transient
  database connection reset during fixture creation rendered only the safe
  localized generic error and succeeded on retry; no runtime correction was
  required. All created requests were left terminal.

## 2026-07-24 — Sprint 05E.1 Vacation Administrator request workspace

- Added a permission-aware, read-only Vacation Administrator request workspace
  with server-backed status, Leave Type, employee search, and year filters.
- Added responsive request tables/cards, shared status badges, pagination, and
  read-only administrator request details with transition history.
- Reused the existing typed Vacation service layer and shared workspace/status
  components. No approval, rejection, cancellation, API, database, migration,
  or dependency changes were added.
- Controlled browser smoke passed for authorized navigation, direct-route and
  API authorization denial, list fields, individual and combined filters,
  filter clearing, empty and safe not-found states, responsive desktop/mobile
  layouts, details/history, light/dark appearance, and a clean console.
- Corrected the list and details routes to render the established localized
  forbidden state without requesting Administrator data when the current user
  lacks `identity.users.manage`. Multi-page pagination was statically reviewed
  but not forced because the configured safe data has only one matching row.

## 2026-07-24 — AI-assisted development workflow

- Established a binding AI-assisted working agreement based on short,
  functional sessions, frequent session resets, narrow delivery boundaries,
  and validation before trust.
- Established repository documentation as authoritative project memory and
  added a concise platform-state snapshot as the starting point for new
  sessions.

## 2026-07-24 — Sprint 05D employee Vacation Portal

- Added employee Vacation dashboard, balance and request summaries, request
  list/detail routes, transition history, controlled request creation, and
  eligible-request cancellation. No Administrator approval UI was added.
- Reused the shared `AppCalendar` and `DateRangePicker`; inclusive API end
  dates are converted to FullCalendar's exclusive all-day event end.
- Added a provisional Monday-to-Friday estimate and balance-aware guidance
  while preserving server authority for working days, overlap, and balance.
- Added localized status, stable Problem Details, retry, empty, loading, and
  dedicated unlinked-employee states in Serbian Latin and English.
- Added the ownership-scoped employee history route required by the detail UI;
  it does not expose another employee's request or alter backend mutations.
- Validated the employee journey in the browser across desktop and mobile
  layouts, light and dark appearance, request creation, authoritative working
  days, detail/history, calendar navigation, and cancellation. The uniquely
  tagged smoke request remains safely terminal as `CANCELLED`.

## 2026-07-24 — Sprint 05C Vacation application layer

- Added Dapper repositories and services for employee Leave Request
  self-service, Administrator review and transitions, balances, history, and
  filtered paginated administration.
- Added the `/api/v1/vacation/me/*` employee routes and
  `/api/v1/vacation/requests/*` Administrator routes. Administration
  temporarily reuses the platform-level `identity.users.manage` permission
  until a dedicated Vacation request-management permission is approved.
- Added the deterministic inclusive Monday-to-Friday calculator with seven
  focused unit cases; public holidays remain out of scope.
- Enforced linked active-employee ownership, server-calculated request fields,
  race-safe overlap translation, balance row locking, and atomic request,
  balance, transition-history, and platform-audit writes.
- Validated the guarded controlled API smoke against an isolated balance
  fixture. Core authorization, request, overlap, approval, balance,
  history, cancellation, period-reuse, rejection, non-balance, and stable
  error-contract scenarios passed. The unlinked-user and second-linked-
  employee checks were skipped because no safe configured fixtures existed.
- Retained smoke requests are intentionally terminal (`CANCELLED` or
  `REJECTED`) because physical deletion is unavailable. The isolated balance
  fixture was restored and removed after read-only post-smoke verification.
- Corrected runtime Dapper handling with one global deterministic `DateOnly`
  handler and explicit history persistence-row timestamp mapping without
  changing public contracts. No Vacation Portal workflow was implemented.

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
