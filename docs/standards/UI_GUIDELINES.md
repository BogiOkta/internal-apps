# Internal Apps Platform — UI Guidelines

| Attribute | Value |
|---|---|
| Status | Implementation standard |
| Governing document | [`../PROJECT_INSTRUCTIONS.md`](../PROJECT_INSTRUCTIONS.md) |
| Architecture | [`../architecture/ARCHITECTURE.md`](../architecture/ARCHITECTURE.md) |
| API conventions | [`../architecture/API_GUIDELINES.md`](../architecture/API_GUIDELINES.md) |
| Applies to | The single Next.js Portal and all module interfaces |

> These guidelines define practical UI conventions for implementation. The accessibility, security, and architecture requirements in the canonical documents still apply.

## 1. Portal Rules

The platform has one Next.js Portal. Every module and administrative page uses the same application shell, identity, navigation, design system, and deployment.

There is no separate admin frontend. Administration is a permission-controlled section inside the Portal.

Frontend modules may:

- add App Router pages;
- contribute navigation items;
- use shared components and services;
- implement module-specific forms, tables, calendars, and workflows.

They may not:

- create a second application shell;
- implement separate login/session behavior;
- call PostgreSQL or expose database concepts;
- duplicate the shared API client;
- use frontend permissions as security;
- create module-specific design systems.

### 1.1 Internal Apps UI identity

The Portal uses familiar patterns from Microsoft productivity software without copying Microsoft branding, proprietary icons, or exact product layouts. Business utility takes priority over decoration.

Permanent direction:

- use one consistent authenticated shell and predictable navigation;
- keep typography compact, readable, and suitable for dense business data;
- treat tables, forms, calendars, and lists as primary working surfaces;
- use cards selectively for launchers and concise summaries, not as the default CRUD layout;
- place commands consistently and keep their labels explicit;
- derive application navigation from the assigned-applications API;
- preserve keyboard operation, visible focus, semantic structure, and sufficient contrast;
- use neutral working surfaces, restrained blue accents, subtle borders, and minimal shadow.

### 1.2 Frontend localization

Source code, database objects, routes, identifiers, application codes, and API contracts remain in English. User-visible Portal text must use typed frontend translation keys.

Current locale rules:

- supported locales are Serbian Latin (`sr-Latn`) and English (`en`);
- Serbian Latin is the default;
- the selected locale is stored locally in the browser and requires no page reload;
- language selectors use language names (`Srpski`, `English`), never country flags;
- known application codes may override only API-provided display name and description;
- unknown application codes retain their API-provided display values;
- future pages must not hardcode visible labels, messages, empty states, or navigation text.

The Portal maps `sr-Latn` to `sr-Latn-RS` and `en` to `en-GB` when a browser locale is required for future `Intl` formatting. Formatting helpers are added only when a screen needs them.

### 1.3 Platform-wide control consistency

The control rule for the entire Internal Apps platform is:

> One purpose uses one standard control across the platform.

This applies to every current and future application, module, administrative
area, and shared platform page—not only Vacation. Controls serving the same
purpose must have consistent behavior and presentation.

Implementation rules:

- a first unique use case may remain local;
- on the second real use case, evaluate extraction into a small shared
  control;
- once a shared standard exists, new screens must use it;
- shared controls own presentation, interaction, and accessibility behavior,
  while domain rules and business state remain with the consuming feature;
- a local alternative requires a concrete business or accessibility reason
  the shared control cannot satisfy;
- speculative controls, configuration-driven UI frameworks, and placeholder
  variants for unimplemented workflows are prohibited.

Improving a shared control improves every consumer through the shared
implementation. Screens must not copy a shared control and evolve a private
variant.

Approved controls provide semantic HTML, visible focus, expected keyboard
operation, accessible names, and correct label/description/error
relationships. Visible text and accessible labels use typed Serbian Latin and
English translation keys.

Disabled controls communicate temporary unavailability and do not accept
input. Read-only fields remain focusable and selectable when useful, are
visually distinct from editable fields, and are not presented as errors.
Control height, padding, label spacing, hint/error spacing, focus rings, and
disabled treatment remain consistent; a page may adjust layout width but must
not invent styling for an ordinary business control.

Field errors appear adjacent to the field, set `aria-invalid`, and are
connected through `aria-describedby`. Safe summary errors are added only when
they materially help recovery. Server validation remains authoritative; raw
API, exception, and database messages are never shown.

An exception requires a documented concrete reason, review by the owning
frontend reviewer, and an update to this standard when it establishes a new
platform pattern. Convenience, preference, or module-specific visual identity
is not sufficient.

## 2. Application Layout

Authenticated pages use this consistent structure:

```text
┌──────────────────────────────────────────────────────────────┐
│ Topbar: menu · context · theme · notifications · user       │
├───────────────┬──────────────────────────────────────────────┤
│ Sidebar       │ Breadcrumbs                                  │
│               ├──────────────────────────────────────────────┤
│ Platform      │ Page header: title · description · actions   │
│ Modules       ├──────────────────────────────────────────────┤
│ Administration│ Main content                                 │
│               │                                              │
└───────────────┴──────────────────────────────────────────────┘
```

| Area | Responsibility |
|---|---|
| Sidebar | Primary module and administration navigation |
| Topbar | Mobile menu, current context, theme, notifications, user/session menu |
| Breadcrumbs | Location within the Portal; current page is not a link |
| Page header | One page title, optional short description, primary actions |
| Main content | Forms, tables, dashboards, calendars, and detail views |

The root authenticated layout owns the shell. Module pages provide page content and optional breadcrumb/navigation metadata; they do not render another sidebar or topbar.

### 2.1 Current authenticated shell

`src/components/app-shell.tsx` is the shared authenticated shell used by Dashboard and Vacation. It:

- resolves the existing authentication session and redirects unauthenticated users to `/login`;
- loads assigned applications once from `GET /api/v1/me/applications`;
- renders desktop sidebar navigation and a mobile navigation drawer from the same data;
- provides page title, optional description, current-user summary, and logout;
- exposes application loading, failure, empty, and loaded states to page content without a global store.

Dashboard is always a platform navigation item. Application links and routes come from the assigned-applications response and are never inferred from username or role. Desktop and mobile navigation use the same active-route rules and close the mobile drawer after navigation.

Business pages follow this hierarchy:

1. Page title and context.
2. Command bar, when commands exist.
3. Filters or secondary navigation, when needed.
4. Main working surface.

The shell provides optional command-bar and secondary-navigation regions so pages align these areas consistently without rendering empty placeholders. Within a command bar:

- create/new is placed on the left;
- edit and related actions follow the primary action;
- search, filter, and export are placed on the right when applicable;
- unavailable commands use an explicit disabled state;
- actions that do not exist are not shown as interactive previews.

### 2.2 Business workspaces

An application may add compact secondary navigation inside the shared shell. The navigation is owned by that application, remains responsive and keyboard accessible, and marks the active section. It must not duplicate or replace global application navigation.

Vacation establishes the first workspace pattern: Overview and Employees are functional sections; future sections are visibly disabled and labeled as coming soon. Read-only functionality is delivered before edit workflows when that provides usable business value.

### 2.3 Sidebar

- Group items by platform area or module.
- Use one Lucide icon per primary item.
- Use short, stable labels.
- Highlight the current route.
- Hide items the user cannot access.
- Collapse to an off-canvas navigation on narrow screens.
- Keep administration in the same sidebar, shown only with relevant permissions.

### 2.4 Page headers

Each page has one visible `h1`. Put the primary action at the end of the page header on desktop and in an accessible, usable location on smaller screens.

Example:

```text
Vacation requests                         [New request]
Review your requests and current status.
```

Do not place the same primary action in multiple competing locations.

## 3. Responsive Design

The Portal is desktop-first because business workflows commonly use tables, multi-field forms, and calendars. It must remain usable on tablet and mobile widths.

Practical rules:

- Design the full desktop workflow first, then define tablet/mobile behavior explicitly.
- Never rely on horizontal page scrolling.
- Tables may use controlled horizontal scrolling when columns cannot collapse safely.
- Stack form fields and header actions on narrow screens.
- Convert the sidebar to a menu drawer.
- Keep touch targets large enough to use reliably.
- Do not hide essential functionality on mobile; simplify its presentation.
- Verify at common narrow, medium, and wide viewport sizes.

Responsive behavior belongs in shared layout and components where possible, not repeated independently by modules.

## 4. Design System

Use Tailwind CSS and shared shadcn/ui components. Lucide is the only standard icon set.

### 4.1 Component selection

Use existing shared components before creating new ones:

- Button, Input, Textarea, Select, Checkbox, Radio Group;
- Dialog, Alert Dialog, Sheet, Dropdown Menu, Tooltip;
- Card, Badge, Tabs, Accordion;
- Table/DataTable, Pagination;
- Toast;
- Skeleton, Alert, EmptyState;
- PageHeader, Breadcrumbs, PermissionGuard.

When adapting a shadcn/ui primitive:

- preserve keyboard and focus behavior;
- use shared variants and tokens;
- keep the adaptation in `components/ui` or the relevant shared component;
- do not copy a modified version into each feature.

Module-specific components stay under `src/features/<module>/components`.

### 4.2 Spacing and typography

- Use the Tailwind spacing scale; avoid arbitrary pixel values without a demonstrated need.
- Use shared content-width and page-padding rules.
- Use one page title, hierarchical section headings, and standard body/small text styles.
- Use cards only when grouping content improves comprehension; do not wrap every section in a card.
- Use semantic status colors with text or icons; color alone must not communicate meaning.
- Use badges for compact status labels, not for primary actions.

### 4.3 Icons

- Use Lucide icons at shared sizes.
- Pair unfamiliar icons with visible text.
- Icon-only buttons require an accessible name and normally a tooltip.
- Do not use decorative icons that add visual noise to every label.
- Use the same icon for the same concept across modules.

## 5. Light and Dark Modes

Both light and dark modes are supported through semantic design tokens.
The Portal shell owns the single Light/Dark/System appearance selector. The
choice is persisted for the entire Portal and System follows the browser
preference. Feature pages and shared components consume the resolved platform
appearance; they do not introduce page-local theme state.

Rules:

- Use token-based background, foreground, border, muted, destructive, and focus colors.
- Do not hard-code light-only colors in feature components.
- Ensure status colors and charts remain distinguishable in both modes.
- Respect the saved user choice; use the system preference when no choice exists.
- Avoid a flash of the wrong theme during initial load.
- Test dialogs, menus, tables, calendars, validation errors, disabled controls, and charts in both modes.

Logos or illustrations that require separate variants must switch with the theme without losing accessible text.

## 6. Forms

Use React Hook Form for form state and Zod for client-side schemas. Server validation remains authoritative.

Approved form-control categories:

- **Text input:** uses the shared field wrapper for label, optional required
  indicator, hint, error, stable IDs, and description wiring. Normal business
  text fields use the shared height, padding, focus, invalid, disabled, and
  read-only treatment.
- **Text area:** follows the same wrapper, focus, hint, and error behavior.
  Business text areas resize vertically, not horizontally.
- **Select:** is for small bounded option sets. It provides a localized label,
  an explicit empty/all option when allowed, and consistent disabled/focus
  behavior.
- **Searchable combobox:** is for large or dynamically loaded sets such as
  employees or organizational units. Do not render hundreds of options in a
  native select. The shared `SearchableCombobox` is the approved implementation
  for this purpose. It provides text search, keyboard navigation, clear
  selection, disabled/read-only states, and accessible combobox/listbox
  semantics while remaining independent of any business domain.
- **Date field:** uses one wrapper/control contract platform-wide. A native
  date input may be the initial implementation; a later date-picker library
  must remain behind the shared contract. API values use the documented ISO
  date contract and visible localization is consistent.
- **Checkbox/toggle:** checkboxes represent independent Boolean form values.
  Switch-style controls are reserved for clear immediate state changes. Do not
  alternate visual patterns for the same Boolean purpose.

Button hierarchy:

- **Primary:** the main constructive or submit action;
- **Secondary:** supporting commands such as cancel, refresh, or edit;
- **Quiet/text:** low-emphasis contextual actions;
- **Destructive:** irreversible or materially destructive actions.

The same action type has the same visual weight across screens. Deactivation
is not destructive styling unless the platform explicitly classifies that
workflow as destructive.

### 6.1 Form structure

- Give every control a visible label.
- Mark required fields consistently.
- Put concise help text before an error message.
- Use the correct input type and autocomplete value.
- Group related controls with headings or fieldsets.
- Keep field order aligned with the user’s task.
- Put primary submit before secondary cancel/back actions in the agreed layout.
- Disable repeated submission while a request is pending.
- Preserve entered values after recoverable server errors.

Recommended field states:

```text
Label *
[ Input value                              ]
Optional help text
Validation or server error
```

Placeholder text is not a label.

### 6.2 Date presentation and date-range filters

All current and future Portal applications MUST use the shared
`src/utils/portal-date-format.ts` utility for user-visible API dates and
timestamps. Serbian Latin display is fixed across the Portal: a date is
`dd.MM.yyyy.` and a date-time is `dd.MM.yyyy. HH:mm`. API and form transport
values remain ISO; pages must not reimplement display formatting with local
`Intl` or string-formatting code.

When a list filters a date field by range, use date-picker inputs in its
expandable grid filter area, with explicit From and To labels. Preserve the
existing clear-all behavior and keep range controls out of the compact command
bar unless date filtering is the page's primary task. A related null/present
state filter may be offered where it has a clear business meaning.

### 6.3 Validation

Zod provides immediate format and required-field feedback. The API may return additional field and business errors through Problem Details.

The form must:

- map server `errors` keys to matching fields;
- show unmatched errors in a form-level alert;
- focus the first invalid field or error summary after submission;
- avoid validating aggressively before the user has interacted;
- avoid clearing server errors unrelated to the edited field;
- distinguish validation failures from network/server failures.

Do not duplicate complex business rules in Zod. Date overlap, leave balance, workflow state, and authorization remain server decisions.

### 6.4 Unsaved changes

Warn before leaving a form with meaningful unsaved changes. Do not warn when only defaults or automatically loaded data changed. After a successful save, reset dirty state before navigation.

## 7. Tables

Use TanStack Table for complex business tables. Simple static key/value content does not require it.

`AdminDataGrid` is the approved default interaction model for administrative
list screens across all modules. The current shared implementation is the
small `admin-data-grid` component set; the standard name describes the
platform pattern rather than requiring one configuration-heavy component.

It provides a semantic HTML table, sortable header buttons, one active sort
column, an optional hidden filter row, global search where applicable, shared
loading and empty states, result and selection counts, a semantic row-selection
control, CSV/XLSX export where appropriate, and permission-aware actions
outside the grid. Each domain continues to own its columns, cell rendering,
filters, row identity, selection behavior, export values, and all business or
CRUD operations.

New modules must not introduce another administrative-grid interaction model
unless this shared standard cannot satisfy a documented concrete requirement.

Each table defines:

- stable column IDs;
- visible labels and accessible headers;
- server-side or client-side ownership of pagination, filtering, and sorting;
- default sort;
- row identity based on `publicId`;
- loading, empty, and error states;
- responsive column behavior;
- permission-aware actions.

### 7.1 Server-side data

Large or unbounded datasets use server-side pagination, filtering, and sorting. Table state maps directly to the API contract:

```text
page=1&pageSize=25&status=pending&sort=-createdAt
```

Do not fetch all records to sort or filter in the browser.

### 7.2 Table actions

- Use a clearly labeled primary row action when one dominates.
- Put secondary actions in a dropdown menu.
- Hide actions the user lacks permission to use.
- Confirm destructive or irreversible actions.
- Keep the row accessible by keyboard.
- Do not make both the whole row and nested controls conflicting click targets.

Administrative lists use one compact grid interaction standard:

- global search remains in the command bar and performs the endpoint's broad
  identifying-field search;
- sortable columns use semantic buttons in table headers and cycle through no
  sort, ascending, descending, and no sort;
- one sort column is active at a time and the active header exposes
  `aria-sort`;
- optional per-column controls appear in a filter row directly below the
  headers and are shown or hidden from the command bar;
- the filter command reports the active column-filter count and provides a
  clear-all action;
- CSV and Excel exports contain the currently displayed logical result in its
  current locale and omit internal/public identifiers unless the business
  contract explicitly requires them;
- selection highlighting is paired with a semantic button in the identifying
  cell; table rows are not assigned button roles.

Wide administrative grids use stable readable column widths and a sensible
table `min-width`; their grid surface, not the page, owns horizontal scrolling.
Do not compress meaningful columns until text becomes unreadable. Keep related
details panels usable beside the grid on desktop and stack them at narrower
widths. Headers use normal title/sentence casing and must not be forced into
uppercase or multi-line labels merely to fit more columns.

Filtering and sorting ownership is explicit per list. Employee search,
department filtering, and sorting remain server-side because the employee
directory may grow. Small bounded reference lists, such as Vacation Leave
Types, may apply documented column filters and additional presentation sorts
client-side after the server has applied global search. Client-side filtering
must never be described as server-side behavior.

The Vacation employee directory consumes shared Organization data; its
placement does not imply Vacation ownership. Authenticated users retain the
directory, while permission-aware Organization administration actions use the
standard right-side details/create/edit panel and remain enforced by the API.

### 7.3 Narrow screens

Prioritize essential columns, allow controlled horizontal scrolling, or provide a card/list representation. Do not shrink text to unreadable sizes. Sorting and filters must remain reachable.

## 8. Calendar

Use FullCalendar for calendar workflows such as vacation and meeting-room views.
`AppCalendar` in the shared Portal component layer is the approved default
calendar surface. Modules supply generic events, resource metadata, callbacks,
and any domain-specific status labels through props; the shared component does
not own business rules or fetch data. It provides month, week, day, and agenda
views, platform navigation, localization, responsive behavior, loading and
empty states, and light/dark appearance support.

New modules reuse `AppCalendar` unless a concrete requirement cannot be met by
its public contract. Domain calendars must not fork FullCalendar setup or place
shared calendar behavior inside a feature module.

The implementation uses the MIT-licensed `@fullcalendar/react` standard
package and its required MIT-licensed `temporal-polyfill` peer dependency.
Day-grid, time-grid, list, interaction, locale, and Forma theme support come
from that single standard package; premium scheduler packages and redundant
date libraries are intentionally excluded. Dependency updates are owned with
the shared Portal UI.

Every calendar implementation specifies:

- time zone;
- locale and first day of week;
- date-only versus timed event behavior;
- all-day semantics;
- event overlap behavior;
- responsive view changes;
- keyboard and screen-reader alternative.

Provide a list or agenda view that exposes equivalent information when the visual grid is not sufficient. Event color is not the only status indicator. Clicking an event opens an authorized detail view; calendar data must already be filtered by the API.

Date-only vacation records must not shift dates due to browser time-zone conversion.

### 8.1 Date ranges

`DateRangePicker` is the approved shared control for date-from/date-to input.
It is a controlled, domain-neutral component with localized boundary values,
disabled/minimum/maximum date support, clear behavior, keyboard operation, and
responsive one- or two-month layouts. Consumers own validation, working-day
calculations, holidays, summaries, and API mapping; those rules do not belong
in the shared picker or `AppCalendar`.

## 9. Dialogs, Toasts, and Feedback

### 9.1 Confirmation dialogs

Use an Alert Dialog for actions that are destructive, irreversible, security-sensitive, or likely to cause significant workflow change.

A confirmation states:

- the exact action;
- the affected resource;
- the consequence;
- the destructive action label.

Good: `Cancel vacation request`  
Avoid: `Are you sure?`

Do not require confirmation for harmless navigation or easily reversible changes. Do not use browser-native `confirm`.

### 9.2 Toast notifications

Use toasts for brief confirmation of completed background UI actions:

- saved successfully;
- request submitted;
- comment added;
- action could not complete, with a safe retry direction.

Do not use a toast as the only place for:

- validation errors;
- permission denial;
- long instructions;
- critical persistent failures;
- information the user must copy or review.

Toasts use concise text, appropriate severity, and an accessible live region. Avoid duplicate toasts when the page already shows the result clearly.

## 10. Loading, Empty, Error, and Success States

Every data-driven screen explicitly handles:

| State | Required treatment |
|---|---|
| Initial loading | Skeleton matching the content shape or a clear progress indicator |
| Background refresh | Keep existing data visible; show subtle refresh progress |
| Empty | Explain what is absent and offer a permitted next action |
| No filter results | Explain that filters produced no results and offer reset |
| Validation error | Field-level errors plus form summary when needed |
| Permission denied | Dedicated access-denied state; do not imply the resource is broken |
| Not found | Safe not-found state without leaking protected existence |
| Unexpected error | Clear message, retry where safe, and support `traceId` |
| Success | Updated content and concise confirmation when useful |

Avoid indefinite spinners. If a request fails, replace loading UI with an actionable error state.

Example empty state:

```text
No vacation requests
You have not created a vacation request yet.
[New request]  ← only when permitted
```

## 11. Permission-Aware Navigation and Actions

The authenticated session provides the user’s effective permission set. Navigation descriptors declare their required permission. The shared shell filters navigation before rendering.

Examples:

| UI item | Permission |
|---|---|
| Vacation module | `vacation.requests.read` or another documented module-entry permission |
| New vacation request | `vacation.requests.create` |
| Approval queue | `vacation.requests.approve` |
| User administration | `identity.users.manage` |
| Role administration | `identity.roles.manage` |

Admin pages appear in the same sidebar only when the user has their required permission. Do not use role-name checks such as `isAdmin`.

Rules:

- Hide unavailable navigation and primary actions by default.
- A disabled action may be shown when explaining how to obtain access is useful.
- Route guards may redirect or render access denied for better UX.
- The API still authorizes every request.
- Handle permission changes during a session: a subsequent `403` is authoritative.

## 12. Accessibility Basics

The target is WCAG 2.2 AA. At minimum:

- Use semantic HTML before ARIA.
- Maintain one `h1` and logical heading order.
- Make all actions operable by keyboard.
- Provide a visible focus indicator.
- Associate labels, help, and errors with controls.
- Give icon-only controls accessible names.
- Manage focus when dialogs open/close and after route/form errors.
- Announce toasts, validation summaries, and async status appropriately.
- Meet color contrast requirements in both themes.
- Never rely on color alone.
- Respect reduced-motion preferences.
- Support browser zoom and reflow.
- Provide text alternatives for meaningful images and charts.

Dialogs, dropdowns, date pickers, tables, and calendars require manual keyboard checks in addition to automated accessibility tests.

## 13. API and Error Integration

All feature services use the shared typed API client. Components do not duplicate base URLs, token handling, Problem Details parsing, or raw endpoint strings.

Map API outcomes consistently:

| API outcome | UI behavior |
|---|---|
| `400` / `422` | Show field and form-level validation |
| `401` | Use approved session recovery/login flow |
| `403` | Show access denied and remove stale unavailable actions |
| `404` | Show not found |
| `409` / `412` | Explain conflict and offer reload/review |
| `429` | Ask user to wait; preserve input |
| `500` / `503` | Show safe error, retry when appropriate, expose `traceId` |

Never display raw server exceptions or JSON dumps to users.

## 14. Implementation Checklist

- [ ] Page uses the single Portal shell; no duplicate admin or module shell exists.
- [ ] Sidebar, topbar, breadcrumbs, page header, and content follow the shared layout.
- [ ] Desktop, tablet, and mobile behavior is defined.
- [ ] Tailwind tokens and shared shadcn/ui components are used.
- [ ] Light and dark modes are verified.
- [ ] Forms use React Hook Form and Zod and display API errors.
- [ ] Complex tables use TanStack Table with bounded server data.
- [ ] Calendars use FullCalendar with explicit date/time behavior and a list alternative.
- [ ] Significant actions use clear confirmation dialogs.
- [ ] Toasts supplement rather than replace persistent error/validation UI.
- [ ] Loading, empty, no-results, denied, not-found, error, and success states exist.
- [ ] Navigation and actions are permission-aware without role-name checks.
- [ ] Admin pages remain inside the Portal and are permission-controlled.
- [ ] Keyboard, focus, labels, contrast, zoom, and announcements are checked.
- [ ] API access uses the shared typed client.
