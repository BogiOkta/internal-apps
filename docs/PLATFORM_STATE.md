# Internal Apps Platform – Current State

## Repository

- Path: `C:\Projects\internal-apps`
- Branch: `main`
- Latest functional milestone: Vacation annual leave entitlement Portal UI.
  The existing Leave Policy route now presents employee/year annual allocation
  with canonical administration layout, localized entitlement terminology,
  shared date entry, and a client-only derived total.

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
  route provides localized year-filtered CRUD administration of those dates
  using `PortalDateInput` (`dd.MM.yyyy.`) rather than native date inputs.
- Shared Portal UI: administrative grid pagination (20 default; 20/50/100),
  form field conventions, shared primary/secondary/danger button utilities,
  global appearance and locale providers, `AppCalendar`, `DateRangePicker`,
  `PortalDateInput`, `AdministrationPageBody`, and the mandatory shared
  Serbian Latin date-display formatter are available. Language and appearance
  preferences are edited on `/settings` and reuse the canonical
  `LocaleProvider` / `AppearanceProvider` storage keys. Organization
  Employees and Departments, Identity Users, and User–Employee links share
  the canonical administration header/toolbar/shell/footer/side-panel
  contract with stable loading, empty, error, and no-selection geometry.
  Remaining Portal areas (Leave Types/Balances, Vacation request UIs,
  Dashboard) are inventoried in `docs/standards/UI_GUIDELINES.md` §7.5 and are
  not migrated in this increment.
- Portal navigation keeps Organization master data and Business Calendar
  administration in a shared Company administration section. Settings is a
  dedicated authenticated navigation item at `/settings`. Vacation navigation
  is limited to leave-request, Leave Type, Leave Policy, and Leave Balance
  work. Logout remains the persistent sidebar footer action; language,
  appearance, and informational user/role cards are not permanently rendered
  in the sidebar. Page headers do not repeat the current user identity.

## Vacation module

- Database foundation: complete; migrations 012–017 are applied and validated.
- Backend API: complete and runtime validated.
- Employee Portal: implemented, validated, and committed. It includes
  the dashboard, balances, own request list and creation, calendar, details and
  transition history, cancellation, and the ownership-scoped history endpoint.
- Administrator Portal: request list, filters, details, history, approval,
  rejection, and administrator cancellation are implemented.
- Annual leave entitlement administration: the existing employee/year CRUD
  route presents current-year entitlement, carry-over, expiry, manual
  adjustment, and a non-persisted derived total. It uses `PortalDateInput` and
  preserves the existing API, persistence, permissions, and calculations.

Detailed state: [Vacation module](modules/vacation.md) and
[Vacation domain](domain/vacation.md).

## Current validation

- Vacation annual leave entitlement Portal UI: strict TypeScript and Portal
  production build passed; focused `PortalAdministrationUiContractTests`
  passed 9/9; `git diff --check` is clean. Controlled browser validation
  passed against fresh services for create/edit/delete and cleanup, Serbian
  Latin and English, desktop/mobile light and dark layouts, `PortalDateInput`,
  derived totals (25, 27, 24, and 28), future/expired/empty expiry states,
  internal grid scrolling without document-level overflow, visible focus
  treatment, and a clean relevant console. The original non-smoke record
  remains and all temporary smoke records were removed.
- Identity administration Design System rollout: Portal strict TypeScript
  passed; Portal production build passed (`/identity/users` and
  `/organization/user-employee-links` included); focused Portal
  source/contract tests passed
  (`PortalAdministrationUiContractTests`, `PortalNavigationContractTests`,
  `BusinessCalendarPortalContractTests`), 17/17. `git diff --check` clean for
  the changed scope. Controlled browser smoke against local API and Portal
  services passed 14/14 for Users and User–Employee Links: shared page header
  New/Refresh placement, shared toolbar, internal grid scrolling, side panel,
  create/edit/details flows, desktop and mobile geometry, Serbian Latin and
  English, light and dark appearance, no document-level horizontal overflow,
  and a clean browser console (excluding pre-existing favicon/`401`
  silent-refresh noise). No persistent smoke data was created.
- Portal Settings and shell simplification: Portal strict TypeScript passed;
  Portal production build passed (`/settings` route included); focused Portal
  source/contract tests passed
  (`PortalNavigationContractTests`, `PortalAdministrationUiContractTests`,
  `BusinessCalendarPortalContractTests`), 15/15. `git diff --check` clean for
  the changed scope. Controlled browser smoke against fresh `internal.ps1`
  services passed 21/21 for: no page-header Administrator/admin identity,
  no permanent sidebar language/appearance selects, Settings navigation
  visible and active on `/settings`, Logout retained at the sidebar footer,
  Serbian Latin and English switching, System/Light/Dark switching,
  preference survival across navigation and reload, business-page language
  and appearance reflection, desktop sidebar and mobile navigation, no
  document-level horizontal overflow, keyboard focus movement, and a clean
  browser console (excluding pre-existing favicon/`401` silent-refresh
  noise). Preference state reused `LocaleProvider` /
  `AppearanceProvider` and `internal-apps.locale` /
  `internal-apps.appearance` storage keys.
- Portal administration UI foundation: Portal strict TypeScript passed;
  Portal production build passed; focused source/contract tests passed
  (`PortalAdministrationUiContractTests`, updated
  `BusinessCalendarPortalContractTests`, and the Organization employee Portal
  contract assertion), 10/10. `git diff --check` clean for the changed scope.
  Controlled browser smoke against fresh `internal.ps1` services passed for
  Departments (loaded rows, selected details, create panel, empty filter,
  desktop/mobile geometry, English, dark), Employees (header/toolbar/grid/
  footer/panel and `PortalDateInput` create fields), and Business Calendar
  (`PortalDateInput` day→month→year typing, required validation, no native
  date input, calendar selection, Serbian Latin and English weekday/month
  labels, light/dark, desktop/mobile, no document horizontal overflow). The
  browser console was clean; no persistent smoke data was created.
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
- Vacation request administration uses `vacation.requests.manage`; refreshed
  Administrator tokens are required after migration 031. Leave Policies and
  Leave Balances continue to use `identity.users.manage`.
- No frontend automated-test framework is currently present.
- Employee pagination is client-side because the current API contract intentionally
  returns a bounded unpaged result. Larger datasets require documented API
  pagination before this remains appropriate.
- Some controlled smoke scenarios require safe configured fixtures.

## Current task

Identity administration Design System rollout: migrate Users and
User–Employee Links to the canonical Portal administration layout already
used by Employees and Departments.

## Next task

No follow-on scope is approved. Do not begin further Portal UI migration
(Leave Types/Policies/Balances, Vacation request UIs, Dashboard) without a
separately approved task.

## Session instruction

New AI sessions must first read:

- [Platform state](PLATFORM_STATE.md)
- [AI working agreement](AI_WORKING_AGREEMENT.md)
- [Vacation module](modules/vacation.md)
