# Internal Apps Platform – Current State

## Repository

- Path: `C:\Projects\internal-apps`
- Branch: `main`
- Latest functional milestone: Organization Department administration
  (backend and Portal) is complete and fully validated, including a
  controlled browser smoke; migration 030 is applied. This scope was
  explicitly approved by the platform owner at session start, superseding the
  prior "do not begin without a separately approved scope" note below.

## Platform foundation

- Authentication: JWT access tokens, refresh rotation, and active-user checks
  are implemented.
- Identity: minimal user administration is complete.
- Organization: employee and department ownership and administration are
  complete, including Department CRUD, activation/deactivation, and safe
  deletion. Employee and department hard deletion are each restricted to
  permanently unreferenced records through an owner-controlled function;
  employee-related and department-related data never cascades.
- User–Employee linking: explicit optional one-to-one links and current-user
  employee resolution are complete.
- RBAC and audit: permission policies and shared atomic audit infrastructure
  are established.
- Business Calendar: the Republic of Serbia shared backend supports explicit
  administrator-maintained non-working dates and inclusive working-day
  calculations with weekends inherently excluded. Vacation delegates all
  working-day calculations to this shared service. A permission-aware Portal
  route provides localized year-filtered CRUD administration of those dates.
- Shared Portal UI: administrative grid pagination (20 default; 20/50/100),
  form field conventions, global appearance, `AppCalendar`, `DateRangePicker`,
  `PortalDateInput`, and the mandatory shared Serbian Latin date-display
  formatter are available. `PortalDateInput` uses segmented `dd.MM.yyyy.`
  keyboard entry, a Serbian Latin calendar, and ISO transport. Organization Employees uses compact search,
  department/status/end-date-state filters, client-side pagination over the
  bounded existing API result, and an internally scrolling wide grid.
  Organization Departments follows the same management-grid and details-panel
  pattern, with server-backed search/status filtering, local bounded-result
  sorting/pagination, localized create/edit forms, and permission-aware
  lifecycle controls.
- Portal navigation keeps Organization master data and Business Calendar
  administration in a shared Company administration section. Vacation
  navigation is limited to leave-request, Leave Type, Leave Policy, and Leave
  Balance work.

## Vacation module

- Database foundation: complete; migrations 012–017 are applied and validated.
- Backend API: complete and runtime validated.
- Employee Portal: implemented, validated, and committed. It includes
  the dashboard, balances, own request list and creation, calendar, details and
  transition history, cancellation, and the ownership-scoped history endpoint.
- Administrator Portal: request list, filters, details, history, approval,
  rejection, and administrator cancellation are implemented.
- Leave Policy foundation: annual employee/year entitlement persistence,
  administrator CRUD API, and minimal administrator Portal are implemented.
  Policies contain entitlement inputs only; balance calculation is deferred.

Detailed state: [Vacation module](modules/vacation.md) and
[Vacation domain](domain/vacation.md).

## Current validation

- Organization Department administration: migration 030 applied successfully
  against the configured database (30 migrations discovered, journaled, no
  pending scripts). API Debug and Release builds: passed with zero warnings
  and errors. Full API test suite with database integration enabled: passed,
  61/61, including seven new focused Department tests covering the endpoint
  and repository contract, migration grant/function shape, immutable code on
  update, delete-conflict token parsing, and live-database checks for the
  controlled delete function (conflict when referenced, success when
  unreferenced, not-found for an unknown department) and the exact granted
  INSERT/UPDATE columns, absent direct DELETE, and function EXECUTE grant.
  `git diff --check` and `git status` were reviewed; no unrelated changes.
- Organization safe-deletion migrations: 29 discovered; migrations 028 and 029
  are already journaled, and migrator verification had no pending scripts.
- Organization safe-deletion database checks: six employee foreign keys, zero
  unsafe delete actions, six shared marker triggers, direct runtime employee
  DELETE denied, marker-table access denied, controlled-function execution
  allowed, and no dependent-row DELETE in the controlled function.
- API tests with database integration enabled: passed, 52/52, including the
  configured-schema legacy-sentinel and unknown-marker cases.
- API Release build: passed with zero warnings and errors.
- Migrator Release build: passed with zero warnings and errors.
- Portal strict TypeScript and production build: passed.
- Organization Department Portal: strict TypeScript and production build passed.
  The management list, details panel, create/edit forms, activation,
  deactivation, and safe-delete conflict presentation are localized in Serbian
  Latin and English.
- Organization Department administration controlled browser smoke: passed for
  login, list loading, search, status filter and reset, sorting, pagination
  controls, create, details, name edit with immutable code, deactivate,
  activate, delete of an unreferenced department, and a referenced-department
  delete conflict with the localized deactivation guidance. The Employee list
  and its department-selection dropdown were confirmed unaffected, matching
  the preserved active-only omitted-status contract. Desktop and mobile
  responsive layouts and Serbian Latin and English rendering passed. Console
  findings were a pre-existing missing-favicon `404`, a pre-existing
  unauthenticated silent-refresh `401` at initial load, and the expected `409`
  from the forced delete-conflict scenario; none originate from this
  increment. All temporary smoke data was created and removed within the
  smoke run, leaving the original six active departments.
- Development reconciler PowerShell parser validation and repository
  whitespace validation: passed.
- LV.2 Leave Balance Portal controlled browser smoke: passed for authorized
  route navigation, employee/Leave Type/year selection, balance/history reads,
  entitlement, carry-over, positive and negative manual adjustment posting,
  validation, duplicate-source and insufficient-balance conflicts, Serbian and
  English rendering, and a clean browser console. A smoke-found stale feedback
  localization defect was corrected; localized feedback now rerenders after a
  language switch. The administrator permission-guard implementation and API
  contract are covered by focused tests; an ordinary-user browser fixture was
  not available in the configured local session.
- LV.2 focused API tests: passed, 36/36. Portal production build and strict
  TypeScript: passed after the smoke correction.
- LV.2 final controlled smoke fixture `LV2SMOKE-20260727091915` passed stored
  working-day approval, exactly one request consumption, exactly one approval
  history event, approved cancellation, exactly one linked opposite reversal,
  exactly one cancellation history event, duplicate-transition protection,
  insufficient-balance rollback, and the non-balance control.
- Leave Policy migration 019: applied successfully.
- Leave Policy focused tests: passed as part of the 24/24 API test suite.
- Leave Policy Portal production route and strict TypeScript: passed.
- Business Calendar Portal contract tests: passed.
- Business Calendar controlled smoke: passed for authorized navigation,
  current-year default, year reload, empty/required states, refreshed edit and
  confirmed delete, unauthorized navigation/direct access, API 401/403/200
  authorization, refresh behavior, safe errors, and a clean console. The
  administrator list `timestamptz` persistence mapping discovered during smoke
  was corrected without changing the API contract. Native date entry and the
  localized duplicate-date UI message were not fully browser-driven; the API
  create/409 conflict/cleanup paths and Portal mapping were validated instead.
- Browser smoke: passed for desktop/mobile layout, light/dark appearance,
  request creation, authoritative working days, details/history, calendar
  navigation, and cancellation.
- Administrator browser smoke: passed for permission-aware navigation and
  route/data denial, list fields, filters and clearing, empty and safe error
  states, responsive layouts, details/history, light/dark appearance, and a
  clean console. Administrator action smoke additionally passed for
  status-dependent action visibility, confirmations, optional comments,
  approval, rejection, submitted and approved cancellation, refreshed
  details/history/list state, localized safe errors, authorization denial, and
  terminal smoke data. The loading label was not observable against the fast
  local API; its disabled duplicate-submission guard was statically confirmed.
  Multi-page pagination was statically reviewed but not forced because only one
  safe matching request exists.
- The unlinked-user state, overlap response, and cross-year rejection were
  statically reviewed but were not forced during browser smoke against the
  configured linked fixture.

## Known limitations

- Business Calendar has no working-Saturday, collective-vacation, regional,
  recurrence, multi-country, or multi-calendar support.
- Vacation administration temporarily reuses `identity.users.manage`; a
  dedicated Vacation administrator permission is not yet introduced.
- No frontend automated-test framework is currently present.
- Employee pagination is client-side because the current API contract intentionally
  returns a bounded unpaged result. Larger datasets require documented API
  pagination before this remains appropriate.
- Some controlled smoke scenarios require safe configured fixtures.

## Current task

Organization Department administration API and Portal are complete. Migration 030
seeds `organization.departments.manage` for the Administrator role, grants the
runtime role only the department INSERT/UPDATE columns and sequence usage
required for audited administration, and adds the owner-controlled
`organization.delete_unreferenced_department(uuid)` function. Department code
is immutable after creation like employee number; name is editable; status
changes use explicit activate/deactivate commands; deletion is restricted to
unreferenced departments and returns the versioned internal
`department_delete_conflict:v1:Organization employee` token on conflict,
mirroring the employee delete-conflict contract. `GET
/api/v1/organization/departments` gained an optional `status` filter
(`active`/`inactive`/`all`); an omitted value preserves the existing
active-only contract so the employee-creation dropdown is unaffected. The
Portal route `/organization/departments` uses the existing Company
administration shell, shared administrative grid, localized details panel and
form conventions, and `organization.departments.manage` permission-aware
actions.
It exposes the existing API contract only: create, name update,
activate/deactivate, and confirmed safe deletion.

## Next task

No follow-on scope is approved. Department administration is complete and
fully validated: build and full test suite (including live-database checks),
Portal strict TypeScript and production builds, and a controlled browser
smoke all passed. Do not begin further scope without a separately approved
task.

## Session instruction

New AI sessions must first read:

- [Platform state](PLATFORM_STATE.md)
- [AI working agreement](AI_WORKING_AGREEMENT.md)
- [Vacation module](modules/vacation.md)
