# Internal Apps Platform – Current State

## Repository

- Path: `C:\Projects\internal-apps`
- Branch: `main`
- Working tree: clean after Sprint 05D finalization
- Latest functional milestone:
  `6a9f3172b17187cd2b5ea318b8ed4a49a49532d9`
  (`feat: add employee vacation portal`)

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
- Shared Portal UI: administrative grid, form field conventions, global
  appearance, `AppCalendar`, and `DateRangePicker` are available.

## Vacation module

- Database foundation: complete; migrations 012–017 are applied and validated.
- Backend API: complete and runtime validated.
- Employee Portal: implemented, validated, and committed. It includes
  the dashboard, balances, own request list and creation, calendar, details and
  transition history, cancellation, and the ownership-scoped history endpoint.
- Administrator Portal: not implemented.

Detailed state: [Vacation module](modules/vacation.md) and
[Vacation domain](domain/vacation.md).

## Current validation

- API Release build: passed with zero warnings and errors.
- API tests: passed, 7/7.
- Portal production build: passed.
- Strict TypeScript: passed.
- Browser smoke: passed for desktop/mobile layout, light/dark appearance,
  request creation, authoritative working days, details/history, calendar
  navigation, and cancellation.
- The unlinked-user state, overlap response, and cross-year rejection were
  statically reviewed but were not forced during browser smoke against the
  configured linked fixture.

## Known limitations

- Public holidays are not supported.
- The Vacation Administrator Portal is not implemented.
- Vacation administration temporarily reuses `identity.users.manage`; a
  dedicated Vacation administrator permission is not yet introduced.
- No frontend automated-test framework is currently present.
- Some controlled smoke scenarios require safe configured fixtures.

## Current task

Sprint 05D is complete.

## Next task

Sprint 05E – Vacation Administrator Portal, in a new AI session.

## Session instruction

New AI sessions must first read:

- [Platform state](PLATFORM_STATE.md)
- [AI working agreement](AI_WORKING_AGREEMENT.md)
- [Vacation module](modules/vacation.md)
