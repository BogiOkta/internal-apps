# Internal Apps Platform – Current State

## Repository

- Path: `C:\Projects\internal-apps`
- Branch: `codex/define-leave-ledger-boundaries`
- Latest functional milestone: LV.2 Leave Balance Ledger vertical slice;
  final validation is recorded below and the commit is authoritative in Git
  history.

## Platform foundation

- Authentication: JWT access tokens, refresh rotation, and active-user checks
  are implemented.
- Identity: minimal user administration is complete.
- Organization: employee and department ownership and administration are
  complete.
- User–Employee linking: explicit optional one-to-one links and current-user
  employee resolution are complete.
- RBAC and audit: permission policies and shared atomic audit infrastructure
  are established.
- Business Calendar: the Republic of Serbia shared backend supports explicit
  administrator-maintained non-working dates and inclusive working-day
  calculations with weekends inherently excluded. Vacation delegates all
  working-day calculations to this shared service. A permission-aware Portal
  route provides localized year-filtered CRUD administration of those dates.
- Shared Portal UI: administrative grid, form field conventions, global
  appearance, `AppCalendar`, and `DateRangePicker` are available.
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

- API Release build: passed with zero warnings and errors.
- API tests: passed, 36/36.
- Portal production build: passed.
- Strict TypeScript: passed.
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
- Some controlled smoke scenarios require safe configured fixtures.

## Current task

LV.2 Leave Balance Ledger API foundation is implemented on migration 020:
immutable
annual-entitlement, carry-over, manual-adjustment, approved-request-
consumption, and cancellation-reversal entries using the existing employee,
Leave Type, and calendar-year dimensions. Current balance and employee history
are derived from those entries. Categories, separate periods, dual control,
annual closing, buckets, allocations, and generic extensibility are deferred.
The API can post annual entitlement, carry-over, and reasoned manual
adjustments and can read derived current balance and ordered history by that
scope. Balance-consuming request approval atomically posts one consumption
from its stored working-day quantity; approved cancellation atomically posts
its exact linked reversal. The permission-aware administrator Portal at
`/vacation/admin/leave-balances` selects the scope, displays the balance and
history, and appends those three entry types. It uses the existing temporary
administrator permission `identity.users.manage`, preserves source idempotency,
and audits successful writes atomically. The request row lock, scoped ledger
lock, and unique causes prevent duplicate request effects, while a negative
ledger result rejects and rolls back approval. Projections, reconciliation
tooling, and legacy cutover remain open. The implemented mutable yearly
balance and Leave Policy foundation remain unchanged.

## LV.2 request-ledger verification

The sufficient-balance approval path is runtime verified. Its remaining
`500` was PostgreSQL SQLSTATE `42601`: the request-derived ledger INSERT
omitted the closing `END` from the nullable reversal-link `CASE`. Adding that
single SQL keyword corrected the repository command; migration 020's applied
schema, triggers, constraints, grants, and sequence privilege were correct, so
no migration was required and migrations 020/021 remain unchanged.

Migration 020 raises
`P0001` when a requested consumption would make the derived ledger balance
negative; Leave Request translates that database exception to the established
`409 vacation_balance_insufficient` result and rolls back the request,
legacy balance, ledger, history, and audit together. Retained fixture
`LV2SMOKE-20260727083334` verified sufficient approval and exactly one
request consumption, insufficient `409` with request/history/ledger/legacy
balance rollback, duplicate transition conflict, and the non-balance control.
The rollback-only database regression executes the real repository command
under `internal_apps_app`. Retained smoke ledger entries were not deleted.

Approved cancellation now resolves migration 020's exact
`request_consumption` entry before inserting one linked
`cancellation_reversal`. The opt-in PostgreSQL regression runs the real runtime
repository command in a rolled-back transaction and verifies the exact link,
equal-and-opposite quantity, and duplicate-reversal unique-constraint
protection. Controlled browser/Portal work remains separate.

## 2026-07-27 LV.2 approved-cancellation correction status

Development-database fixture replay found that Leave Type creation could not
set `requires_balance`, and the runtime INSERT grant omitted that column. The
narrow contract correction and migration 021 were applied. The subsequent
sufficient-credit insertion `500` is corrected and the required sufficient
and insufficient scenarios are verified as described above. The
approved-cancellation correction was smoke-verified with fixture
`LV2SMOKE-20260727084338`: one consumption, one exact linked reversal, and
duplicate cancellation conflict. Retained fixture attempts use the
`LV2SMOKE-` prefix and were not deleted.

## Next task

No post-LV.2 task is approved. Begin the next independently documented scope
in a fresh session.

## Session instruction

New AI sessions must first read:

- [Platform state](PLATFORM_STATE.md)
- [AI working agreement](AI_WORKING_AGREEMENT.md)
- [Vacation module](modules/vacation.md)
