# Internal Apps Platform change history

## 2026-07-27 — Portal company-administration navigation polish

- Added the localized Company administration / Administracija firme section
  to the shared responsive Portal navigation. It contains the canonical
  Organization Departments and Employees routes, plus the permission-aware
  Business Calendar non-working-days route; existing Identity administration
  links remain permission-aware there as well.
- Removed Organization pages from the Vacation workspace navigation. Vacation
  navigation now presents leave requests, Leave Types, and administrator-only
  request, Leave Policy, and Leave Balance work without changing any route,
  API, ownership, or permission contract.
- Removed the redundant desktop header initial avatar and updated the dashboard
  application wording to My applications / Moje aplikacije. Added focused
  Portal navigation contract coverage.

## 2026-07-27 — Organization historical employment data

- Added migration 022 to extend Organization employees with nullable middle
  name and employment start/end dates, and made email nullable while retaining
  the existing case-insensitive unique index when an email is present.
- Extended employee API contracts, repository mappings, validation, and Portal
  forms/details for the historical fields. Employee number remains immutable,
  department remains required, and explicit `employment_status` remains the
  only active/inactive authority; end dates do not deactivate employees.
- Preserved read access to inactive employees and added focused migration and
  API/Portal contract tests. No employment-history tables, multiple periods,
  deletion, or broader HR features were introduced.

## 2026-07-27 — LV.2 final review and validation

- Reviewed the complete uncommitted vertical slice against the LV.2 amendments
  in ADR-0005 and ADR-0006, including migrations 020/021, API, Portal, request
  integration, runtime smoke, tests, documentation, least privilege, and
  append-only retention.
- Corrected the Leave Type Portal create request to supply the API-required
  `requiresBalance` value from the existing counts-against-balance choice, and
  cleared loaded ledger data/forms when the administrator changes scope so a
  posting cannot silently target the previously displayed scope.
- Strengthened the controlled smoke to assert exactly one approval history
  event and one cancellation history event. Development-only retained fixture
  `LV2SMOKE-20260727091915` passed the complete approval/cancellation,
  reversal, duplicate, insufficient rollback, and non-balance scenarios.
- Migration validation found 21 applied migrations and no pending scripts;
  API Release build, 36/36 API tests, Portal production build with strict
  TypeScript, and Git diff checks passed.

## 2026-07-27 — LV.2 approved-cancellation reversal correction

- Corrected the request-ledger cancellation lookup to use migration 020's
  `request_consumption` entry kind instead of the stale `consumption` value.
  The existing transactional transition continues to restore the legacy
  balance, append the exact linked `cancellation_reversal`, write request
  history and audit, and commit as one unit.
- Extended the opt-in real PostgreSQL runtime regression to verify the exact
  `reverses_entry_id` link, equal-and-opposite quantity, and unique-constraint
  rejection of a duplicate reversal in a rolled-back transaction.
- Updated the controlled smoke to verify duplicate approved cancellation is a
  conflict and leaves exactly one reversal. Fixture
  `LV2SMOKE-20260727084338` passed approval, cancellation, reversal linkage,
  duplicate protection, insufficient rollback, and the non-balance control.

## 2026-07-27 — LV.2 sufficient-approval runtime correction

- Captured the remaining sufficient-balance approval failure under
  `internal_apps_app` as `Npgsql.PostgresException`, SQLSTATE `42601`,
  `syntax error at or near "FROM"`. The request-derived INSERT in
  `LeaveBalanceLedgerRepository.InsertRequestEntryAsync` omitted the closing
  `END` from its nullable reversal-link `CASE`; PostgreSQL rejected the
  command before constraints or triggers ran and left the transaction aborted.
- Added only the missing SQL `END`. Migration 020's applied table, constraints,
  triggers, grants, sequence privilege, request scope, negative signed
  quantity, internal request linkage, and numeric request source reference
  were verified correct, so no migration was added and migrations 020/021 were
  not edited.
- Added an opt-in rollback-only xUnit integration test that executes the real
  repository command, API `DateOnly` handler, runtime role, and applied
  PostgreSQL trigger contract. Updated the controlled smoke assertions to
  verify migration 020's internal request/source linkage and least-privilege
  read boundary.
- Retained fixture `LV2SMOKE-20260727083334` passed sufficient approval with
  exactly one consumption, insufficient approval with
  `409 vacation_balance_insufficient` and atomic request/history/ledger/legacy
  balance rollback, duplicate transition conflict, and the non-balance
  control. No append-only entry was deleted.

## 2026-07-27 — LV.2 development-database smoke correction

- Added the timestamp-prefixed `scripts/smoke/lv2-request-ledger.ps1` fixture
  workflow for the explicitly approved development database; ledger entries
  are retained and reported.
- Corrected Leave Type creation to accept `requiresBalance` and migration 021
  grants the runtime role INSERT access to that existing column only.
- Sufficient ledger credit succeeded, but request approval initially returned
  an unhandled `500` during request-ledger insertion. The later entry above
  records its verified correction; no append-only ledger entry was deleted.

## 2026-07-27 — LV.2 Leave Request ledger smoke blocked by local fixture

- Started the documented local API and Portal using the existing developer
  Data Protection key ring and authenticated with the configured smoke
  identities.
- The configured linked smoke employee has no `vacation.leave_balances` record
  for any active balance-consuming Leave Type, and `.env` has no documented
  Vacation smoke date range. Consequently, a request approval would stop at
  `409 vacation_balance_not_found` before the LV.2 posting path.
- No direct database fixture was inserted, no append-only ledger entry was
  created or deleted, and no request, history, or audit smoke record was
  retained. The Portal/browser and complete request-ledger smoke remain
  pending an approved local balance fixture and date range.

## 2026-07-27 — LV.2 Leave Request approval insufficient-balance correction

- Diagnosed the balance-consuming approval `500` as an unhandled migration-020
  ledger-trigger `P0001` exception: `Leave balance entry would make the balance
  negative.` The request transition already rolls back atomically when the
  insert fails.
- Translated that precise database condition to the established
  `409 vacation_balance_insufficient` workflow result, preserving the atomic
  rollback of request status, mutable baseline, append-only ledger, history,
  and audit.
- Added regression coverage that binds the application exception translation
  to migration 020's non-negative trigger contract. A runtime-role replay in
  an always-rolled-back transaction verified one consumption with sufficient
  temporary credit and the exact insufficient-balance database exception.
- Retained smoke ledger entries were not modified. Portal/browser workflow and
  cancellation-reversal smoke remain outside this focused correction.

## 2026-07-26 — LV.2 Leave Request ledger integration

- Balance-consuming approval now posts exactly one idempotent
  `request_consumption` entry using the Leave Request's stored working-day
  quantity. Cancelling an approved request posts one exact, linked
  `cancellation_reversal`; other transitions have no ledger effect.
- The request row transition, existing mutable-balance baseline mutation,
  ledger entry, request history, and platform audit use one database
  transaction. Ledger non-negative enforcement rejects approval and rolls back
  every part of the transition.
- Scoped ledger locking, unique request-derived business causes, and the
  reversal-to-consumption uniqueness constraint protect concurrent approvals,
  retries, duplicate consumption, and duplicate reversal. No public
  request-derived ledger posting endpoint was added.
- Added focused regression coverage for transaction ordering, stored-quantity
  usage, reversal linkage, and insufficiency rollback. Annual closing, expiry,
  buckets, allocations, projections, Portal features, and cutover remain out
  of scope.

## 2026-07-25 — LV.2 Leave Balance Portal

- Added the permission-aware administrator route
  `/vacation/admin/leave-balances`, with employee, balance-consuming Leave
  Type, and calendar-year selection; derived current balance; and
  acceptance-ordered ledger history.
- Added simple localized entry forms for annual entitlement, carry-over, and
  reasoned manual adjustments. The Portal mirrors required scope, half-day,
  positive-credit, effective-year, reason, and source-reference validation;
  API authorization, idempotency, and non-negative balance enforcement remain
  authoritative.
- Added focused Portal contract checks for ledger routes, permission guarding,
  validation shape, and the absence of deferred ledger controls. No dashboard,
  chart, export, projection, annual closing, expiry, bucket, or request
  workflow integration was added.
- Controlled browser smoke passed for the administrator route, scoped employee,
  Leave Type, and year loading, derived balance and history, annual
  entitlement, carry-over, positive and negative manual adjustments, native
  validation, duplicate-source and insufficient-balance conflicts, Serbian and
  English rendering, and a clean console. Smoke entries are retained as the
  append-only ledger has no deletion operation. A stale localized feedback
  string remained Serbian after switching to English; feedback now retains a
  translation key and rerenders in the active language.

## 2026-07-25 — LV.2 Leave Balance Ledger API foundation

- Added administrator-authorized API commands to append annual entitlement,
  carry-over, and reasoned manual-adjustment entries, preserving the migration
  020 source-idempotency and append-only constraints.
- Added derived current-balance and acceptance-ordered history reads for one
  employee, balance-consuming Leave Type, and calendar year.
- Successful posts append a platform audit event in the same transaction;
  input, missing references, duplicate sources, and insufficient balance map
  to stable validation, not-found, or conflict responses.
- Deliberately excluded Leave Request approval/cancellation integration,
  Portal UI, annual closing, expiry, buckets, allocations, projections, and
  deferred ledger capabilities.

## 2026-07-25 — LV.2 Leave Balance Ledger database foundation

- Added migration 020 with the Vacation-owned append-only
  `leave_balance_entries` ledger. Its key is employee, existing balance-
  consuming Leave Type, and calendar year; its five entry kinds are annual
  entitlement, carry-over, manual adjustment, request consumption, and
  cancellation reversal.
- Enforced public and business-cause uniqueness, half-day signed quantities,
  effective-date year scope, actor-or-system origin, request scope/quantity,
  one exact reversal per consumption, non-negative balances under a scoped
  transaction lock, and database-level update/delete rejection.
- Granted the runtime role only ledger SELECT/INSERT and identity-sequence
  usage. Added focused migration-contract validation. No API, Portal,
  request-workflow integration, annual close, expiry, bucket, allocation,
  projection, or cutover was introduced.

## 2026-07-25 — Leave Balance Ledger LV.2 reduction

- Reduced ADR-0005 and ADR-0006 to the smallest viable ledger: append-only
  annual entitlement, carry-over, manual adjustment, approved-request
  consumption, cancellation reversal, derived current balance, and employee
  balance history.
- Kept the existing Leave Type and calendar-year concepts; explicitly deferred
  categories, separate periods, dual control, annual closing, buckets,
  allocations, and premature generic extensibility.
- Defined the first vertical slice without approving SQL, migrations, APIs, or
  application code.

## 2026-07-25 — Leave Balance Ledger logical persistence

- Accepted ADR-0006 with Vacation-owned categories, calendar-year periods,
  prospective Leave Type mappings, employee/category/period accounts, and
  dual-control adjustment authorizations.
- Defined immutable transaction headers and signed entries, typed idempotent
  source correlation, entry-level reversal/correction relationships, and
  public-identifier boundaries.
- Required opening-entitlement and carry-over buckets plus debit allocations
  to preserve expiry, priority, non-compounding, closing eligibility, and
  exact reversal.
- Defined one atomic annual closing per period and the logical uniqueness and
  integrity rules without introducing SQL, migrations, APIs, projections, or
  application code.

## 2026-07-25 — Leave Balance Ledger business rules

- Finalized account dimensions, supported balance effect types, working-day
  half-day precision, calendar-year entitlement periods, carry-over,
  expiration, deterministic consumption priority, and the fixed non-negative
  policy.
- Finalized dual-controlled manual adjustments, full reversal versus
  replacement correction, annual closing, and append-only historical
  consistency.
- Recorded the business rationale, owner capability, and
  fixed-versus-configurable classification for every rule without introducing
  a database, SQL, API, or application design.

## 2026-07-25 — Leave Balance Ledger domain boundaries

- Accepted ADR-0005, keeping the Leave Balance Ledger inside Vacation and
  separating its responsibilities from Leave Policy, Leave Request,
  Organization, Business Calendar, Core Audit, and the Portal.
- Defined append-only balance effects, traceable compensation, idempotent
  business causes, derived and reconcilable balances, atomic approval posting,
  exact approved-cancellation reversal, non-negative concurrent approval, and
  historical quantity stability as core invariants.
- Prohibited policy, request, calendar, audit, Portal, cross-module, and
  premature shared-Core ownership overlaps.
- Recorded the domain decisions that block database design, including account
  dimensions, policy mapping, units, period and carry-over lifecycle,
  adjustments, ordering, projections, and legacy cutover. No table, migration,
  API, or application design was introduced.

## 2026-07-25 — Sprint LV.1 Leave Policy foundation

- Added `vacation.leave_policies`, with one annual entitlement policy per
  employee and leave year, non-negative entitlement and carry-over, optional
  carry-over expiration, a signed manual adjustment, notes, and timestamps.
- Added administrator list/get/create/update/delete API operations with leave
  year and employee filters, employee-name sorting, transactional audit, and
  stable validation, not-found, invalid-employee, and duplicate employee/year
  Problem Details.
- Added the permission-aware `/vacation/admin/policies` Portal route with
  employee/year selectors, a simple create/edit form, confirmed deletion, and
  the requested entitlement columns.
- Leave Policy represents annual entitlement only. No balance, remaining,
  consumed, or used-day value is stored or calculated; balance calculation and
  all allocation/request-processing automation remain deferred.
- Applied migration 019 and validated the API Release build, 24/24 focused and
  regression API tests, Portal production build, strict TypeScript, and Git
  diff checks. Browser smoke was intentionally not run.

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
