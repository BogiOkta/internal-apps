# Internal Apps Platform change history

## 2026-07-30 — Canonical tabbed-screen hierarchy for the Portal platform

- Established `docs/standards/UI_GUIDELINES.md` §2.5 as the canonical layout
  for every current and future Portal screen with tab navigation: module
  header (title, description, only truly module-global actions) → tab
  navigation → active section header (section title, description, and the
  actions that belong only to that tab) → filters → section content.
  Tab-specific actions must never be placed in the module header; the tabs
  answer “Where am I?” and the active section header answers “What can I do
  here?”. The rule was added to the §1.5 new-screen checklist.
- Added the shared `PortalSectionHeader` control
  (`apps/portal/src/components/portal-section-header.tsx`; registered in
  §1.4): `h2` section title, optional description, primary and secondary
  action slots, right-aligned actions on desktop that wrap below the
  description on narrow screens, no feature-specific behavior.
- Migrated the Vacation workspace to the hierarchy. `VacationWorkspace` now
  renders a stable module header (`vacation.workspace.title` /
  `vacation.workspace.description`) and the active section header below the
  tabs; its `commandBar` / `headerActions` pass-through was replaced by
  `sectionActions` / `sectionSecondaryActions`. “Novi zahtev” moved to the
  Requests (and Overview) section header, “Nova vrsta” and “Osveži” to the
  Leave Types section header, “Evidentiraj odsustvo” to the Request
  Administration section header, and “Novo pravo” / “Osveži” to the Leave
  Policies section header. Permissions and business behavior are unchanged.
- Removed the shell command band between the module header and the tabs
  (`AppShell` `commandBar`), which had no remaining consumer and is now a
  prohibited ambiguous layout. Single-section administration pages keep
  their module-header New/Refresh placement.
- Extended `PortalAdministrationUiContractTests` with a tabbed-screen
  contract: migrated Vacation screens must render the canonical active
  section header, place known tab-specific actions in it, and must not pass
  actions to the module-level header; `PortalSectionHeader` joined the
  shared-control ownership and anti-duplication registry checks.
- Added controlled Playwright smoke
  `scripts/smoke/tabbed-screen-hierarchy.mjs` for the hierarchy matrix.

## 2026-07-30 — Portal canonical control platform standard

- Established `docs/standards/UI_GUIDELINES.md` §1.3–§1.5 as the Portal
  platform control standard for every current and future application module:
  single registry, prohibition on feature-specific copies of approved
  controls, demonstrated-need rule for new shared components, exact temporary
  exceptions, and a new-screen checklist.
- Shared Portal controls under `apps/portal/src/components` now include
  `ConfirmDialog`, `StatusBadge`, `PortalDateInput`, form-field helpers
  (`formControlClassName`, primary/secondary/danger/danger-solid buttons),
  administration shell/toolbar/pagination helpers, and related date utilities.
- Migrated mechanical consumers across Organization, Identity, Business
  Calendar, Vacation administration, and Vacation self-service off
  `window.confirm`, local button/input class constants, and native date
  inputs.
- Portal-wide contract tests reject native date inputs, browser confirm/alert,
  forbidden local class constants, feature-local date display formatters, and
  known naming patterns for module-prefixed copies of canonical controls.
- Remaining non-mechanical exceptions remain documented in §1.4 (Vacation
  request admin pagination/shell, Leave Balances shell, calendar toolbar
  chrome, domain `VacationStatusBadge`).

## 2026-07-30 — Vacation administrative absence recording

- Reused `vacation.leave_requests` with one immutable `source` column:
  `EMPLOYEE_REQUEST` or `ADMINISTRATIVE_ENTRY`; existing requests default to
  employee-request source.
- Added the administrator recording flow under the existing
  `vacation.requests.manage` permission. It creates an immediately approved
  request atomically with balance validation, ledger consumption when required,
  one null-to-approved history transition, and `leave_request_recorded` audit.
- Extended administrator request list/details and the Portal form with source,
  source filtering, and Recorded/Evidentirano presentation for approved
  administrative entries. Cancellation remains the established exact-reversal
  path and administrative entries expose no Approve/Reject action.
- Added the repeatable `scripts/smoke/administrative-absence-entry.ps1`
  development smoke. It uses unique `ADMSMOKE-<UTC timestamp>` fixtures,
  validates the approved balance and non-balance paths, exact cancellation,
  rollback/error cases, source filtering, and reports retained append-only
  records. Runtime smoke also found and corrected the migration grant so the
  application role may insert the existing decision columns used by the
  direct-approved flow while retaining no permission to update `source`.

## 2026-07-30 — Canonical Vacation Leave Type administration

- Added migration `032_vacation_leave_type_administration.sql`. It reuses the
  existing `vacation.leave-types.manage` permission, seeds no new permission,
  grants the runtime role the previously missing `requires_balance` column
  `UPDATE`, and creates the owner-owned `SECURITY DEFINER` function
  `vacation.delete_unreferenced_leave_type(uuid)` with `EXECUTE` granted only to
  the runtime role. No runtime `DELETE` grant and no direct SQL delete path
  exist, matching the Organization Department pattern from migration 030.
- Added safe deletion through `DELETE /api/v1/vacation/leave-types/{publicId}`.
  A leave type is physically deleted only when it has never been referenced by
  `vacation.leave_requests`, `vacation.leave_balances`, or
  `vacation.leave_balance_entries`. Otherwise the API returns the canonical
  `409` `leave_type_delete_conflict` Problem Details with controlled dependency
  labels, and the Portal shows a localized message explaining that the leave
  type is already in use and should be deactivated instead. Dependent Vacation
  data never cascades.
- Enforced the business rules: `Code` stays immutable after creation;
  `Requires Balance` and `Counts Against Balance` are editable only while the
  leave type is unused and are locked afterward by a derived `isInUse` flag
  projected from the same three referencing tables; deactivation is always
  allowed and historical records continue to resolve the leave type.
- Migrated `/vacation/leave-types` to the canonical Portal administration
  foundation (`AdministrationPageHeader` via the workspace shell,
  `AdministrationPageBody`, `AdministrativeGridShell` with `fillViewport`,
  `AdministrativeGridToolbar`, `GridPagination`, the shared side panel, and the
  shared button and form-control helpers), removing page-local command-bar
  chrome and `GridFooter`. Grid columns are Code, Name, Counts Against Balance,
  Requires Balance, Requires Approval, Active, and Actions; the details panel
  shows all business fields plus the derived usage state; the edit panel renders
  lock hints where the business rules prevent editing.
- Added focused `VacationLeaveTypeAdministrationTests`, extended
  `PortalAdministrationUiContractTests`, and updated `UI_GUIDELINES.md`,
  `docs/domain/vacation.md`, and `docs/modules/vacation.md`.

## 2026-07-29 — Vacation annual leave entitlement Portal UI

- Reframed `/vacation/admin/policies` as annual leave entitlement allocation
  by employee and year, with localized Serbian Latin and English terminology.
- Migrated the expiry field to shared `PortalDateInput`, retained nullable ISO
  transport, and added a client-only live Total allocated display and grid
  column derived from existing values.
- Adopted the canonical administration header, toolbar, grid shell,
  pagination, side panel, and restrained expiry state indication without any
  backend, API, database, permission, or persistence change.

## 2026-07-29 — Identity administration Design System rollout

- Migrated Identity Users and User–Employee Links to the canonical Portal
  administration layout already used by Employees and Departments:
  `AdministrationPageBody`, `AdministrativeGridShell` with `fillViewport`,
  `AdministrativeGridToolbar`, `GridPagination`, shared form controls and
  button helpers, and the shared side panel.
- Removed page-local bordered list/aside layout and `GridFooter` usage from
  those pages without changing permissions, API contracts, or business
  behavior. Client-side pagination remains because the list APIs stay
  bounded and unpaged.
- Updated focused Portal administration UI contract tests and
  `UI_GUIDELINES.md` §7.5 inventory.

## 2026-07-28 — Portal Settings and shell simplification

- Added authenticated `/settings` for language (Serbian Latin / English) and
  appearance (System / Light / Dark), reusing the existing `LocaleProvider`
  and `AppearanceProvider` persistence keys without a second preference state.
- Simplified the authenticated shell: page headers no longer repeat the
  current user identity; sidebar language, appearance, and informational
  user/role controls were removed; Logout remains the stable sidebar footer
  action; Settings navigation is available to every authenticated user.
- Updated `UI_GUIDELINES.md` and focused Portal navigation contract tests.

## 2026-07-28 — Portal administration UI foundation stabilization

- Fixed `AdministrativeGridShell` so viewport-fill height collapse (`lg:h-0`)
  is gated behind an explicit `fillViewport` prop and paired with
  `AdministrationPageBody`, eliminating the Department regression that
  collapsed the grid into toolbar-only content when the flex `min-height: 0`
  chain was missing.
- Aligned Organization Employees and Departments to the shared administration
  contracts: page header New/Refresh placement, `AdministrativeGridToolbar`,
  `AdministrativeGridShell`, `GridPagination` without a redundant record-count
  footer, and shared form button utilities.
- Replaced Business Calendar native `type="date"` entry with `PortalDateInput`
  (`dd.MM.yyyy.`, ISO transport) and adapted Non-working Days to the Company
  administration visual language (canonical header, list card, right-side form
  panel).
- Localized shared `PortalDateInput` month and weekday labels from the current
  Portal language instead of hardcoded Serbian labels; Serbian Latin and
  English now render their own calendar labels without changing keyboard
  entry, visible formatting, or ISO values.
- Updated `UI_GUIDELINES.md` with the one-control-per-purpose rollout rule,
  native-date prohibition, administration-page structure, required states, and
  an inventory of remaining unmigrated Portal areas.
- Added focused Portal administration UI source/contract tests.


## 2026-07-28 — Vacation request-administration permission

- Added immutable migration 031 to seed `vacation.requests.manage` and assign
  it to the Administrator role. Vacation request list, detail, history,
  approval, rejection, and cancellation now require that dedicated policy;
  existing Administrator tokens require refresh after the migration.
- Updated the Portal request-administration route, navigation, and action
  guards to use the same permission. Employee self-service, Leave Policies,
  Leave Balances, Business Calendar, workflow behavior, and `403` handling
  remain unchanged.
- Corrected the pre-existing unfiltered request-administration list query to
  bind nullable PostgreSQL filter parameters with explicit types; no request
  contract or workflow behavior changed.

## 2026-07-28 — Organization Department administration final review and validation

- Reviewed the complete uncommitted Department Administration increment
  (migration, API, tests, Portal, localization, and documentation) against
  the Employee administration conventions, confirming immutable department
  code, the preserved active-only omitted-status contract for the employee
  directory and creation dropdown, correct `organization.departments.manage`
  enforcement, no database internals reaching API clients, controlled and
  localized safe-delete conflict behavior, and no unrelated changes.
- Re-verified the full validation sequence: Migrator and API Release builds
  (zero warnings/errors), migration application (30 discovered, all
  previously journaled, no pending scripts), the full API test suite with
  database integration enabled (61/61), Portal strict TypeScript, and the
  Portal production build. A stray auto-generated `next-env.d.ts` route-path
  change produced by running the build was reverted as unrelated to this
  increment.
- Completed the controlled browser smoke that earlier sessions could not run:
  login, department list load, search, status filter and reset, sorting,
  pagination, create, details, name edit with immutable code, deactivate,
  activate, delete of an unreferenced department, a referenced-department
  delete conflict with localized deactivation guidance, unaffected Employee
  list and department-selection dropdown, desktop and mobile responsive
  layouts, and Serbian Latin and English rendering. Temporary smoke data was
  fully created and removed within the run. Console findings (a missing
  favicon `404`, a pre-existing unauthenticated silent-refresh `401`, and the
  expected `409` from the forced conflict scenario) predate this increment
  and were not introduced by it.
- No implementation defect was found; no code changes were required.

## 2026-07-28 — Organization Department administration Portal

- Replaced the read-only Department directory with a permission-aware
  administration workspace at `/organization/departments`: localized list,
  search and active/inactive filtering, bounded-result sorting and pagination,
  details panel, and CSV/Excel export reuse the existing administrative-grid
  pattern.
- Added localized create and name-edit forms; department code remains visibly
  read-only after creation. The existing Department API is used unchanged for
  create, update, activate, deactivate, and confirmed safe deletion.
- A referenced-department delete conflict presents the safe deactivation
  guidance from the backend contract. Strict TypeScript and the production
  Portal build passed. No frontend test runner or supported local browser was
  available for focused UI or browser smoke validation.

## 2026-07-28 — Organization Department administration backend

- Added migration 030: seeds `organization.departments.manage` for the
  Administrator role, grants the runtime role only the department
  INSERT/UPDATE columns and sequence usage required for audited
  administration, and adds the owner-controlled
  `organization.delete_unreferenced_department(uuid)` function. The function
  checks the same-module `organization.employees.department_id` dependency
  directly rather than reusing the cross-schema employee marker mechanism.
- Added Department create, update, activate, deactivate, and safe-delete API
  endpoints under `/api/v1/organization/departments`, following the Employee
  administration pattern: immutable code, editable name, explicit
  activate/deactivate commands, and a versioned
  `department_delete_conflict:v1:Organization employee` delete-conflict token
  parsed against a fixed allowlist. `GET /api/v1/organization/departments`
  gained an optional `status` filter; an omitted value preserves the existing
  active-only contract for untouched Portal consumers.
- Backend-only increment; no Portal, Employee, or unrelated Organization
  behavior changed. Validated with the full API test suite (61/61, database
  integration enabled), API Debug and Release builds, and `git diff --check`.

## 2026-07-28 — Employee delete-conflict legacy-marker correction

- Added forward-only migration 029. It leaves canonical marker rows unchanged
  and omits only the exact stored legacy sentinel `Protected employee
  dependency` from a versioned delete-conflict token when specific dependency
  labels exist. Sentinel-only and unknown-marker cases retain the safe generic
  API fallback; unknown labels are never partially exposed.

## 2026-07-28 — Organization Employees polish completion

- Applied migration 028. The owner-controlled Employee delete function now
  emits only the versioned internal `employee_delete_conflict:v1:` token;
  the API accepts only its controlled dependency labels and never forwards
  PostgreSQL detail or redaction text.
- Standardized Serbian Employee terminology to `Šifra`, `Odeljenje`, and
  `E-mail`; ordered the grid and exports accordingly; added compact codes,
  natural default code sorting, and independent clear controls for the three
  select filters.
- The minimal runner opens the configured Portal URL once only after readiness;
  `-NoBrowser`, `status`, and `stop` avoid browser launch.

## 2026-07-27 — Organization Employees pagination and date-input standard

- Refined `PortalDateInput` to the platform Serbian segmented date standard:
  `dd.MM.yyyy.` keyboard entry with automatic separators, normalized paste,
  real calendar validation, and an integrated Serbian Latin Monday-first
  calendar. API date-only transport remains ISO `yyyy-MM-dd`.

- Simplified Employee filters to global search, organization unit, employee
  status, and a compact end-date state; removed the four employment date-range
  controls while preserving reset behavior.
- Added the shared administrative-grid pagination pattern: default 20 rows,
  20/50/100 page sizes, visible range/total, first/previous/next/last controls,
  filter/sort-before-pagination semantics, and page-one resets.
- Employee deletion conflicts now map only known generic dependency names to
  concise business labels and preserve the stable conflict code, deactivation
  guidance, and a safe no-list fallback.

## 2026-07-27 — Organization Employees Portal UX increment

- Established `src/utils/portal-date-format.ts` as the mandatory Portal
  display formatter: dates render as `dd.MM.yyyy.` and date-times as
  `dd.MM.yyyy. HH:mm`. Migrated safe visible date and timestamp usages in
  Organization Employees, Vacation requests, Business Calendar, Leave Policy,
  and Leave Balance administration.
- Updated the employee grid to use normal-cased concise date headers, keep
  `Ime i prezime` separate from optional `Srednje ime`, provide expandable
  Serbian date-range and end-date-state filters, and preserve existing API
  filters and reset behavior. Date ranges are client-side after existing
  server-side employee filtering; no API or backend behavior changed.
- Made the employee grid a readable wide, internally horizontally scrolling
  surface with the details panel retained at desktop width. Disabled the
  Next.js development indicator, whose framework-provided circular `N` was the
  duplicate-looking bottom-left control; the canonical sidebar user/logout
  controls remain unchanged.
- Documented the shared date formatter, date-range filter behavior, and wide
  administrative-grid standards.

## 2026-07-27 — Organization employee administration increment

- Added responsive Employment start/end date columns and confirmed administrator deletion.
- Hardened deletion so the runtime role cannot directly delete employees; the
  API uses an owner-controlled function that rejects every referenced employee
  with deterministic `409 employee_delete_conflict` and never deletes history.
- Preserved the already-journaled anonymous dependency marker in migration 025,
  upgraded it forward to declarative dependency names in migration 026, and
  added migration 027 so already-upgraded databases return those names without
  rewriting an applied migration as the repair mechanism.
- Corrected the development Okta reconciler to 29 employees: duplicate `1` is removal-only when unreferenced and `123` is canonical.

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
