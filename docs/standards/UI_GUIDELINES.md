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
- language and appearance preferences are changed on `/settings`;
- language selectors use language names (`Srpski`, `English`), never country flags;
- known application codes may override only API-provided display name and description;
- unknown application codes retain their API-provided display values;
- future pages must not hardcode visible labels, messages, empty states, or navigation text.

The Portal maps `sr-Latn` to `sr-Latn-RS` and `en` to `en-GB` when a browser locale is required for future `Intl` formatting. Formatting helpers are added only when a screen needs them.

### 1.3 Platform-wide control consistency

The control rule for the entire Internal Apps platform is:

> One purpose uses one standard control across the Portal platform.

This is the **Portal platform control registry**. It applies to every current
and future application module, administrative area, and shared platform
page—not only Vacation. Organization, Identity, Business Calendar, Vacation,
and every later module MUST consume the same approved controls.

§1.4 is the single source of truth for which component or helper is approved
for each control purpose. Feature modules MUST NOT create
application-specific equivalents of an approved Portal control. Examples of
prohibited future duplication include `VacationDateInput`, `HrDateInput`,
`WmsDateInput`, feature-local `primaryButtonClass` / `inputClass` constants,
feature-local confirmation overlays that recreate `ConfirmDialog`, and
feature-local active/inactive badge chrome that recreates `StatusBadge`.

Implementation rules:

- a first unique use case may remain local;
- on the second real use case, evaluate extraction into a small shared
  Portal control under `apps/portal/src/components` (or the documented shared
  helper path);
- shared controls are introduced only from demonstrated need, never
  speculatively and never as unused placeholder wrappers;
- once a shared standard exists, new screens must use it;
- new Portal pages MUST reuse the existing canonical shared components for
  the same purpose rather than introducing parallel primitives;
- shared controls own presentation, interaction, and accessibility behavior,
  while domain rules and business state remain with the consuming feature;
- every new shared control MUST define behavior, import path, and ownership
  in §1.4 in the same change that introduces it, and SHOULD add regression
  protection where practical;
- when a required control does not yet exist: (1) verify that an existing
  canonical component/helper cannot satisfy it; (2) add the smallest shared
  Portal component; (3) document it in §1.4; (4) add regression protection
  where practical; (5) only then use it in the feature;
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

Exceptions MUST be exact (file path), documented in §1.4, temporary, and
state a removal condition. Convenience, preference, or module-specific visual
identity is not sufficient.

### 1.4 Approved control registry

This registry is the single definitive source of truth for approved Portal
platform form and administration controls. Ownership of every listed shared
control is the Portal shared UI layer under `apps/portal/src/components`
(helpers may also live under `apps/portal/src/utils` or `apps/portal/src/i18n`
when documented). Feature pages MUST import the canonical component or helper
listed here. Local recreation of an equivalent control is prohibited once the
shared implementation exists.

Automated enforcement lives in
`tests/api/InternalApps.Api.Tests/PortalAdministrationUiContractTests.cs`
unless a row says otherwise.

| Category | Purpose | Canonical | Import | Required behavior | Prohibited alternatives | Allowed exceptions | Automated enforcement |
|---|---|---|---|---|---|---|---|
| Date input | User-facing date entry | `PortalDateInput` | `@/components/portal-date-input` | Visible `dd.MM.yyyy.`; day→month→year keyboard entry; segment selection; calendar picker; ISO `yyyy-MM-dd` at API boundaries; sr-Latn/en; light/dark; mobile | Native `<input type="date">`; page-local date widgets; ad-hoc editable parsers | None | Yes — Portal-wide scan rejects `type="date"` / `type='date'` |
| Date range | From/to range selection | `DateRangePicker` | `@/components/date-range` | Localized boundaries; keyboard; responsive months; consumers own validation and working-day math | Native date inputs; unrelated non-canonical pair of date widgets | None | Partial — consumers asserted where migrated |
| Date/time display | Read-only API dates | `formatPortalDate`, `formatPortalDateTime` | `@/utils/portal-date-format` | Serbian Latin `dd.MM.yyyy.` and `dd.MM.yyyy. HH:mm` | Feature-local `Intl` / string formatters for that contract | Shared calendar widgets may use `Intl` for month/weekday labels only | Yes — rejects feature-local `toLocaleDateString` / hand-rolled display formatters outside allowlist |
| Text input | Ordinary text/search/password | `formControlClassName` + `<input>` inside `FormField` | `@/components/form-field` | Shared height, focus, invalid, disabled, read-only | Page-local height/border/focus stacks for ordinary fields | Composing `formControlClassName()` with layout spacing (`mt-1`, `w-full`) is allowed | Yes — rejects known forbidden local `inputClass` / button class constants |
| Numeric input | Bounded numbers | Same as text input with `type="number"` | `@/components/form-field` | Same chrome; step/min/max owned by the form | Parallel numeric chrome | None | Same as text input |
| Textarea | Multi-line notes | `formControlClassName` + `<textarea>` | `@/components/form-field` | Vertical resize only; shared focus/invalid | Parallel textarea chrome | None | Same as text input |
| Select | Small bounded options | `formControlClassName` + `<select>` | `@/components/form-field` | Localized empty/all option when allowed | Custom select clones for ordinary bounded lists | None | Same as text input |
| Searchable combobox | Large/dynamic option sets | `SearchableCombobox` | `@/components/searchable-combobox` | Search, keyboard, clear, accessible combobox semantics | Native `<select>` with hundreds of options; page-local combobox forks | None | Contract tests on known consumers |
| Checkbox | Independent Boolean form values | Native `<input type="checkbox">` with shared label spacing | Feature forms | Visible label; consistent gap | Switch styling for ordinary Booleans | No shared checkbox primitive yet; do not invent a second pattern | None yet |
| Toggle/switch | Immediate on/off state changes only | Not yet approved as a shared primitive | — | Do not introduce until a second real use case exists | Page-local switch clones | None present | None |
| Primary button | Main constructive/submit action | `formPrimaryButtonClassName` | `@/components/form-field` | Blue filled; focus ring; disabled opacity | `primaryButtonClass` and one-off blue stacks | Login may append layout width (`w-full`) | Yes — rejects `primaryButtonClass` / `secondaryButtonClass` / `dangerButtonClass` declarations |
| Secondary button | Cancel, back, supporting commands | `formSecondaryButtonClassName` | `@/components/form-field` | Bordered neutral | Feature-local secondary class exports | Calendar toolbar navigation buttons remain calendar-owned | Yes |
| Danger button | Destructive outline actions | `formDangerButtonClassName` | `@/components/form-field` | Red outline | One-off danger stacks | None | Yes |
| Danger solid button | Destructive confirm inside `ConfirmDialog` | `formDangerSolidButtonClassName` | `@/components/form-field` | Red filled confirm | Inline solid-red class strings for the same purpose | None | Contract asserts helper existence |
| Action icons | Canonical create/refresh/export/delete glyphs before command labels | `PortalActionIcon`, `portalActionContent` | `@/components/portal-action-icon` | create→plus; refresh→refresh; export→download; delete→trash; decorative when label present; icon-only needs accessible name | Feature-local SVG icons for the same commands; hand-written icon chrome on pages | None | Yes — known create/refresh consumers |
| Icon-only button | Compact icon commands | Semantic `<button>` + accessible name; `PortalActionIcon` | Shared/calendar toolbars | Visible focus; `aria-label` | Icon buttons without accessible names | `calendar-toolbar` keeps local sizing for calendar chrome | None |
| Field wrapper | Label, required, hint, error | `FormField`, `fieldDescriptionIds` | `@/components/form-field` | Stable IDs; hint/error wiring | Divergent hand-rolled label/error blocks for ordinary fields | Dense grid filter cells may use `sr-only` labels | None beyond consumer contracts |
| Confirmation dialog | Destructive/consequential confirm | `ConfirmDialog` | `@/components/confirm-dialog` | Message; optional title/children; confirm/cancel; destructive tone; no browser `confirm` | `window.confirm` / `confirm()`; duplicated amber/red panels | None | Yes — rejects `window.confirm` / `window.alert` |
| Operation notification | Transient success/warning/error/info feedback for page operations | `PortalNotification` | `@/components/portal-notification` | Variants; dismiss; aria-live; stable placement that does not shift the primary grid | Full-width operation banners above administration grids; parallel toast stacks | Field/form validation stays beside the field (§1.6) | Yes — migrated admin pages |
| Modal/dialog | Overlay dialogs beyond inline confirm | Not yet a shared overlay primitive | — | Prefer `ConfirmDialog` for confirmations | Ad-hoc full-screen modal frameworks | Calendar popovers owned by date controls | None |
| Status badge | Compact status labels | `StatusBadge` for active/inactive/yes-no; `VacationStatusBadge` for leave-request statuses | `@/components/status-badge`; `@/features/vacation/components/vacation-status-badge` | Non-color indicators remain with text labels | Parallel active/inactive chip chrome | Domain request statuses stay in `VacationStatusBadge` | Partial |
| Loading state | In-progress data | `GridStateRows` inside admin grids; localized page pulse/message elsewhere | `@/components/admin-data-grid` | Stable shell geometry | Full-page spinners that collapse admin chrome | Self-service pages keep localized loading blocks | Admin pages via existing contracts |
| Empty state | No rows / no data | `GridStateRows` or localized empty copy inside content viewport | `@/components/admin-data-grid` | Explain absence; offer permitted next action | Empty chrome that collapses grid geometry | Self-service `Empty` helpers remain until a second shared empty primitive is justified | Admin pages via existing contracts |
| Error state | Safe recoverable failure | Localized alert + retry where safe | Page / `GridStateRows` | No raw API dumps; expose `traceId` when supportable | Hard-coded exception text | Self-service `ErrorState` helpers remain for non-admin surfaces | Admin pages via existing contracts |
| Pagination | Admin list footers | `GridPagination` (20/50/100) | `@/components/grid-pagination` | Range summary; page size; first/prev/next/last | Second count rows; `GridFooter` on Organization-aligned pages | Vacation request administration retains server-driven prev/next with API `pageSize` 25 until that shell is migrated | Yes for migrated admin pages; allowlisted exception file for vacation admin list |
| Administration page header/body | Title, description, New/Refresh; viewport fill chain | Shell `headerActions`; `AdministrationPageBody` | `@/components/administration-page-body` (+ header via shell) | Title left; New then Refresh right | Duplicate header chrome | Dashboard and pure self-service | Migrated admin pages |
| Active section header | Section title, description, and tab-specific actions on screens with tab navigation (§2.5) | `PortalSectionHeader` | `@/components/portal-section-header` | Rendered below the tabs; `h2` title left; optional description; primary then secondary actions right on desktop, wrapping below on narrow screens | Tab-specific actions in the module header or in a command band above the tabs; page-local section-header chrome | None | Yes — tabbed Vacation screens contract test |
| Tab navigation | Secondary section tabs under the module header | `WorkspaceNavigation` | `@/components/workspace-navigation` | Medium/semibold labels; subtle separators between adjacent tabs only; active underline; hover/focus; overflow scroll; light/dark | Feature-local tab separator chrome; boxed/pill tabs for this navigation purpose | Unrelated segmented controls/filters | Yes — Vacation workspace + anti-duplication |
| Administration toolbar | Search, filters, export | `AdministrativeGridToolbar` | `@/components/administrative-grid-toolbar` | Search → filters → export (export uses canonical export icon) | Parallel filter command bars on admin grids | Vacation request admin filter form remains until shell migration | Migrated admin pages |
| Administrative grid shell | Bordered grid + optional side panel | `AdministrativeGridShell` | `@/components/admin-data-grid` | Internal scroll; stable states; optional `detailsNotification` below right-rail details/confirmation; `fillViewport` only with body chain | Parallel bordered grid/panel frames; operation banners above the grid | Non-tabular forms; Leave Balances / Vacation request admin pending shell rollout | Migrated admin pages |
| Calendar | Month/week/day/agenda | `AppCalendar` | `@/components/calendar` | Platform locale/appearance; list/agenda alternative | Forked FullCalendar setup in features | None | Demo/consumer contracts |
| Localization | User-visible text | `LocaleProvider`, `useTranslations` | `@/i18n/…` | sr-Latn default; en; typed keys | Hardcoded labels | None | Navigation/locale contracts |
| Appearance/theme | Light/Dark/System | `AppearanceProvider` | `@/components/appearance-provider` | Semantic tokens; settings-owned preference | Page-local theme state | None | Settings/shell contracts |

**Date rule (normative):** All user-facing date entry fields MUST use
`PortalDateInput`. Native user-facing `<input type="date">` is not allowed
unless an explicit row above documents an exception.

**Confirmation rule (normative):** Browser-native `window.confirm` and
`window.alert` are prohibited in Portal feature code.

**Button rule (normative):** Feature modules MUST NOT declare
`primaryButtonClass`, `secondaryButtonClass`, or `dangerButtonClass` constants.

**Operation feedback rule (normative):** Transient operation success, warning,
and error messages MUST use `PortalNotification` in a stable region that does
not shift the primary grid, filters, or page chrome. Full-width operation
banners above administration grids are prohibited. Field and form validation
messages remain beside the relevant control and may participate in layout.

### 1.6 Validation messages vs operation notifications

Two distinct message categories:

1. **Field or form validation** — stays next to the relevant field or form
   (`FormField` error, form-level summary when needed). May change local
   layout around the form. Uses `aria-invalid` / `aria-describedby` for fields.
2. **Operation feedback** — create/update/delete/activate results, delete
   conflicts, refresh failures, export failures, and similar page-operation
   outcomes. Uses `PortalNotification` only. Placement:
   - administration pages with a right rail: `AdministrativeGridShell`
     `detailsNotification` (below details, actions, and `ConfirmDialog`);
   - equivalent custom right-rail layouts (for example Business Calendar):
     the same position inside the aside, below confirmation;
   - pages without a right rail: a stable non-layout-shifting host owned by
     the shared notification pattern (do not invent a second toast stack).

Confirmation (`ConfirmDialog`) and completed-operation notification remain
separate visual blocks. Do not auto-dismiss destructive or important error
guidance too quickly; always offer dismiss where the message is transient.

Documented temporary exceptions (exact file + reason + removal condition):

| File | Reason | Removal condition |
|---|---|---|
| `apps/portal/src/features/vacation/components/admin-vacation-request-list.tsx` | Custom server-paged prev/next UI with fixed API `pageSize` 25; not yet on `AdministrativeGridShell` / `GridPagination` | When Vacation request administration is migrated to the canonical administration shell |
| `apps/portal/src/app/vacation/admin/leave-balances/page.tsx` | Tabular history + posting form outside the administration grid shell | Dedicated Leave Balances administration-shell task |
| `apps/portal/src/components/calendar/calendar-toolbar.tsx` | Calendar-specific navigation chrome sizing | Remains calendar-owned unless a second non-calendar toolbar needs the same control |
| `apps/portal/src/features/vacation/components/vacation-status-badge.tsx` | Domain leave-request status vocabulary (`SUBMITTED`/`APPROVED`/…); not a copy of generic `StatusBadge` | Remains domain-owned; do not replace with generic `StatusBadge` tones |

### 1.5 New screen checklist

Before merging a new Portal screen or form:

- [ ] Use canonical controls from §1.4; do not invent module-prefixed copies.
- [ ] Use `LocaleProvider` / `useTranslations` for all user-visible text.
- [ ] Use `AppearanceProvider` tokens; do not add page-local theme state.
- [ ] Use `formatPortalDate` / `formatPortalDateTime` for read-only API dates.
- [ ] Use `PortalDateInput` / `DateRangePicker` for editable dates; never
      native `type="date"`.
- [ ] Use `AdministrationPageBody`, `AdministrativeGridShell`,
      `AdministrativeGridToolbar`, and `GridPagination` for administration
      grids where the administration contract applies.
- [ ] Do not declare local `inputClass`, `primaryButtonClass`,
      `secondaryButtonClass`, or `dangerButtonClass` constants.
- [ ] Use `ConfirmDialog` for destructive or consequential confirmations;
      never `window.confirm` / `window.alert`.
- [ ] On screens with tab navigation, follow the §2.5 tabbed screen
      hierarchy: module header → tabs (`WorkspaceNavigation`) →
      `PortalSectionHeader` → filters → content. Tab-specific actions live in
      the active section header, never in the module header. Do not recreate
      tab separator or active-tab chrome locally.
- [ ] Use `portalActionContent` / `PortalActionIcon` for create, refresh,
      export, and delete command icons; do not hand-write those SVGs in
      feature pages.
- [ ] Use `PortalNotification` for operation feedback in a stable region
      (`detailsNotification` on right-rail admin pages). Do not place
      operation success/error banners above the primary grid.
- [ ] If introducing a new shared control category, document it in §1.4
      (behavior, import path, ownership) and add or update Portal contract
      protection in the same change.

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

`src/components/app-shell.tsx` is the shared authenticated shell used by Dashboard, Vacation, Company administration, and Settings. It:

- resolves the existing authentication session and redirects unauthenticated users to `/login`;
- loads assigned applications once from `GET /api/v1/me/applications`;
- renders desktop sidebar navigation and a mobile navigation drawer from the same data;
- provides page title, optional description, optional header actions, and logout;
- exposes application loading, failure, empty, and loaded states to page content without a global store.

Page headers show title, optional description, and optional actions only. They do not repeat the authenticated user's display name or username; identity remains available through auth context for pages that need it (for example dashboard welcome text).

Language and appearance preferences are edited on `/settings`. The sidebar does not permanently render language or appearance selectors, and it does not show an informational user/role card. Logout remains the stable sidebar footer action.

Dashboard is always a platform navigation item. Settings is available to every authenticated Portal user and appears in a dedicated Settings section near the bottom of primary navigation, above Logout. Application links and routes come from the assigned-applications response and are never inferred from username or role. Desktop and mobile navigation use the same active-route rules and close the mobile drawer after navigation.

Business pages follow this hierarchy:

1. Page title and context (the module header).
2. Secondary navigation (tabs), when the screen has multiple sections.
3. The active section header, on tabbed screens (§2.5).
4. Filters or section controls, when needed.
5. Main working surface.

The shell provides optional header-actions and secondary-navigation regions so pages align these areas consistently without rendering empty placeholders. There is no command band between the module header and the tabs. Within any action group:

- create/new is placed first, followed by supporting actions such as refresh;
- search, filter, and export belong to the grid toolbar, not the header;
- unavailable commands use an explicit disabled state;
- actions that do not exist are not shown as interactive previews.

### 2.2 Business workspaces

An application may add compact secondary navigation inside the shared shell. The navigation is owned by that application, remains responsive and keyboard accessible, and marks the active section. It must not duplicate or replace global application navigation. Screens that use such tab navigation follow the canonical tabbed screen hierarchy in §2.5.

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

Each page has one visible `h1`. On screens without tab navigation, put the primary action at the end of the page header on desktop and in an accessible, usable location on smaller screens. On screens with tab navigation, the page header is the module header and section actions move below the tabs (§2.5).

Example (single-section screen):

```text
Departments                               [New department]
Manage organizational units.
```

Do not place the same primary action in multiple competing locations.

### 2.5 Tabbed screen hierarchy (canonical)

Every Portal screen with multiple tabs uses this exact vertical hierarchy.
It is a platform rule: all current and future Portal modules MUST follow
this structure, not only Vacation.

```text
┌──────────────────────────────────────────────────────────────┐
│ 1 Module header: module title · module description           │
│   (only truly module-global actions, if any)                 │
├──────────────────────────────────────────────────────────────┤
│ 2 Tab navigation: Section A │ Section B │ Section C           │
├──────────────────────────────────────────────────────────────┤
│ 3 Active section header: section title · description         │
│                                    [Primary] [Secondary]     │
├──────────────────────────────────────────────────────────────┤
│ 4 Filters or section controls                                 │
├──────────────────────────────────────────────────────────────┤
│ 5 Section content: grid · form · dashboard · details          │
└──────────────────────────────────────────────────────────────┘
```

Region purposes:

- **Module header** — identifies the module or application (`h1` title and
  a short module-level description). It stays visually stable while the
  user moves between tabs. It answers no task question; it provides
  context. It may contain only actions that are genuinely global to the
  whole module.
- **Tab navigation** — identifies the active section. It answers
  “Where am I?”. Tabs stay in one consistent position on every section of
  the module and mark the active section. The shared `WorkspaceNavigation`
  (`@/components/workspace-navigation`) owns presentation: medium or
  semibold labels, subtle vertical separators between adjacent tabs only
  (never before the first or after the last), the canonical active
  underline/accent, hover and focus states for light and dark appearance,
  and horizontal overflow scrolling. Keep the compact underline pattern;
  do not convert tabs into boxed pills or recreate separator styling in
  feature pages.
- **Active section header** — the shared `PortalSectionHeader`
  (`@/components/portal-section-header`). It renders the active section
  title (`h2`), an optional section description, and the actions that
  belong only to that section. It answers “What can I do here?”.
- **Filters / section controls** — status filters, scope selectors, and
  grid toolbars appear below the active section header, never above it
  and never inside the module header.
- **Section content** — the working surface (grid, form, dashboard,
  details) appears below the filters.

Action placement:

- **Tab-specific actions MUST live in the active section header.** An
  action that belongs only to one tab must never be placed in the module
  header. Examples: “New request” belongs to the Requests section header;
  “New leave type” and “Refresh” belong to the Leave Types section header;
  “Record absence” belongs to the Request Administration section header.
- Primary actions come first, then secondary actions (refresh, export
  helpers), in the same right-aligned group of the section header.
- Search, column filters, and export commands stay in the grid toolbar
  inside the working surface, as on non-tabbed administration pages.
- **The module header must not contain actions that apply only to one
  tab.** A module-level action is genuinely allowed only when it operates
  on the module as a whole, is available and meaningful on every tab, and
  does not duplicate a section action. No current Portal module has such
  an action; treat any proposed one as an explicit design decision, not a
  convenience.

Prohibited ambiguous layouts:

- section actions in the module header, above or visually detached from
  the tab navigation;
- a command band between the module header and the tabs;
- a second competing title between the tabs and the section content;
- the same action rendered both above and below the tabs;
- filters rendered above the active section header;
- per-module forks of the section-header chrome.

Responsive behavior:

- desktop: section title and description on the left, actions
  right-aligned in the same section header, with clear visual ownership
  inside that header;
- narrow screens: title and description first, actions wrap below them;
  no horizontal page overflow; tabs remain scrollable and usable;
- the module header, tabs, section header, filters, and content keep the
  same horizontal content bounds.

The heading order is stable: the module header owns the page `h1`; the
active section header is an `h2`; content headings nest below it.

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

Use Tailwind CSS and shared shadcn/ui components. Canonical command icons are
owned by `PortalActionIcon` (plus / refresh / download / trash mapping).

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

- Canonical create, refresh, export, and delete command icons use
  `PortalActionIcon` / `portalActionContent` (`@/components/portal-action-icon`).
  Mapping: create → plus; refresh → refresh; export → download; delete → trash.
- Pair unfamiliar icons with visible text. When a text label is present, the
  icon is decorative (`aria-hidden`).
- Icon-only buttons require an accessible name and normally a tooltip.
- Do not insert hand-written SVG for the same command concepts in feature
  pages, and do not add a parallel icon package for ordinary Portal actions.
- Use the same icon for the same concept across modules.

## 5. Light and Dark Modes

Both light and dark modes are supported through semantic design tokens.
The Portal owns a single Light/Dark/System appearance preference through
`AppearanceProvider` (`internal-apps.appearance` local storage). Users change
that preference on `/settings`. The choice is persisted for the entire Portal
and System follows the browser preference. Feature pages and shared components
consume the resolved platform appearance; they do not introduce page-local
theme state. Language preference is owned by `LocaleProvider`
(`internal-apps.locale`) and is also changed on `/settings`. Do not permanently
render language or appearance controls in the sidebar.

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
- **Date field:** uses the shared `PortalDateInput` contract platform-wide for
  every user-facing date entry. Native `input type="date"` is prohibited in
  Portal forms because browser locale formatting (for example `mm/dd/yyyy`)
  breaks the platform `dd.MM.yyyy.` contract. API values use the documented
  ISO date contract; visible localization remains consistent through the
  shared control.
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

### 6.2 Date presentation and editable input

All current and future Portal applications MUST use the shared
`src/utils/portal-date-format.ts` utility for user-visible API dates and
timestamps. Serbian Latin display is fixed across the Portal: a date is
`dd.MM.yyyy.` and a date-time is `dd.MM.yyyy. HH:mm`. API and form transport
values remain ISO; pages must not reimplement display formatting with local
`Intl` or string-formatting code. Editable date fields MUST use the shared
`PortalDateInput`. Native browser date inputs (`type="date"`) MUST NOT appear
in user-facing Portal forms.

`PortalDateInput` required contract:

- visible format `dd.MM.yyyy.`;
- immediate numeric entry from day to month to year with automatic separators;
- segment selection on focus/click;
- equivalent calendar selection path;
- optional clear when the field is nullable;
- required validation where the consuming form requires a date;
- ISO `yyyy-MM-dd` values for API communication;
- Serbian Latin and English calendar month/weekday labels derived from the
  current Portal locale, with control commands supplied through typed
  translation keys;
- light and dark appearance through shared tokens;
- consistent focus, invalid, disabled, and read-only treatment.

Users type digits only; initial focus selects the day segment, and each
completed segment advances day/month/year while separators render
automatically. Arrow keys move predictably between segments, Tab keeps native
form navigation, and the optional clear command remains available when
nullable. Invalid calendar dates are rejected adjacent to the field and
nullable values remain empty. Date-time display remains `dd.MM.yyyy. HH:mm`.

`PortalDateInput` and `DateRangePicker` share the Portal date-control visual
contract: medium rounded borders, 40px minimum control height, shared padding,
visible blue focus treatment, muted disabled treatment, red invalid treatment
where validation applies, aligned calendar triggers, and token-based light and
dark appearance. Feature pages must consume these shared components and their
shared date-control utility rather than duplicating date-input styling.

Administrative list pages use `AdministrativeGridShell` as the canonical grid
frame. It provides a bordered, rounded card; an optional toolbar; a
`min-height: 0` table viewport with internal overflow; a pagination and summary
footer that remain outside the scrolling region; responsive horizontal table
scrolling; and an optional independently scrolling details panel. Pages that
fill the desktop application viewport must opt into the shell's
`fillViewport` layout **and** wrap page content in `AdministrationPageBody`
(or an equivalent flex `min-height: 0` chain under `contentFillsViewport`).
`fillViewport` applies `lg:h-0` / `lg:flex-1` only when that parent chain
exists; applying those classes without the chain collapses the grid into
toolbar-only content. Loading, empty, error, and no-selection content belongs
inside the grid viewport or side panel so surrounding page geometry remains
stable. On narrow screens, the grid and details panel stack and the table
retains horizontal scrolling.

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

### 7.1 Administrative-grid pagination

Administrative grids default to client-visible pages of **20** rows and offer
only **20**, **50**, and **100** rows per page. They show the visible range and
total (for example `1–20 od 29`) and provide previous/next plus first/last
controls. Filtering, sorting, and a page-size change reset to page 1; sorting
and filtering always apply before pagination. The page layout must not gain
horizontal overflow: only the grid surface may scroll horizontally, and a
selected row's details remain usable when the row is on another page.

Server pagination remains required for large or unbounded API collections.
Where an existing endpoint returns a bounded unpaged array, the shared grid
may page it client-side as a temporary limitation; it must be documented on
the consuming screen's platform state until the API supports paging.

### 7.2 Server-side data

Large or unbounded datasets use server-side pagination, filtering, and sorting. Table state maps directly to the API contract:

```text
page=1&pageSize=25&status=pending&sort=-createdAt
```

Do not fetch all records to sort or filter in the browser.

### 7.3 Table actions

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

Filtering and sorting ownership is explicit per list. The currently bounded
Employee directory applies its end-date presentation filter and natural
alphanumeric grid sorting client-side before pagination, after server-side
search, department, and status filtering. Larger Employee datasets require a
documented paginated API contract before this changes. Small bounded reference
lists, such as Vacation Leave Types, may apply documented column filters and
additional presentation sorts client-side after the server has applied global
search. Client-side filtering must never be described as server-side behavior.

The Vacation employee directory consumes shared Organization data; its
placement does not imply Vacation ownership. Authenticated users retain the
directory, while permission-aware Organization administration actions use the
standard right-side details/create/edit panel and remain enforced by the API.

### 7.3 Narrow screens

Prioritize essential columns, allow controlled horizontal scrolling, or provide a card/list representation. Do not shrink text to unreadable sizes. Sorting and filters must remain reachable.

### 7.4 Administration-page layout contract

Organization administration pages and aligned Company administration screens
use `AdministrationPageHeader` through the Portal shell and
`AdministrativeGridShell` (or an equivalent bordered list card plus right-side
form panel when a table shell is not appropriate) for their working area.

Canonical placement:

| Region | Contents |
|---|---|
| Page header | Title and description on the left; primary New, then Refresh, on the far right |
| Grid toolbar | Search, then filter controls, then export |
| Grid footer | One localized visible-range summary, page-size selector, and pagination only |
| Side panel | Details, create, or edit content sharing the shell border, radius, and padding; operation notifications via `detailsNotification` below details/confirmation |

The header keeps the title and description on the left and places the primary
New action, then Refresh, on the right; actions wrap below the description on
narrow screens. Search, filter commands, exports, and optional result context
belong in `AdministrativeGridToolbar` inside the bordered grid card, in that
order.

The shell owns the rounded border, elevation, internal table scrolling,
responsive grid/panel stacking, and desktop side-panel width. Table headers
remain sticky inside the viewport. `GridPagination` is the sole list footer:
its range summary is on the left and page size plus navigation are on the
right. Do not add a second record-count or selection-summary row that repeats
the total (`GridFooter` is not part of the Organization administration
contract).

Details, create, and edit content use the shell side panel so they share the
grid card's border, radius, elevation, padding, heading spacing, and responsive
behavior. Domain pages own their fields, columns, data operations, and
permission-aware actions, not their structural layout.

Required states for every administration working surface:

| State | Required treatment |
|---|---|
| Loading | Progress or skeleton inside the content viewport; shell geometry stable |
| Empty | Localized empty title/description inside the content viewport |
| Error | Safe localized error with retry where appropriate |
| No selection | Side panel explains that a row must be selected |
| Selected details / create / edit | Side panel retains valid dimensions |

### 7.5 Remaining Portal UI rollout inventory

The following Portal areas still use older or partial administration patterns
and are **not** migrated in the current Identity / Organization administration
UI increment. Do not modify them unless a separately approved task requires
it:

| Area | Gap relative to the canonical contract |
|---|---|
| Vacation Leave Balances | Uses `PortalDateInput` and shared form helpers; still outside the full administration grid shell |
| Vacation request employee self-service | Outside administration shell; uses canonical buttons/`FormField`/`DateRangePicker` |
| Vacation request administration | Filter form and fixed `pageSize` 25 prev/next pagination remain until shell migration; form controls and confirmations use shared helpers |
| Dashboard | Outside scope; launcher surface, not an administration grid |

Identity user administration, User–Employee links, and Vacation Leave Types now
reuse the same Organization administration contract as Employees and
Departments: `AdministrationPageHeader` (via the shell),
`AdministrationPageBody`, `AdministrativeGridToolbar`,
`AdministrativeGridShell` with `fillViewport`, `GridPagination`, shared form
controls and button helpers, and the shared side panel. Client-side pagination
applies because those list APIs remain bounded and unpaged.

Leave Types is the first migrated administration grid with an explicit Actions
column. Its grid columns are Code, Name, Counts Against Balance, Requires
Balance, Requires Approval, Active, and Actions. Its side panel shows every
business field plus a derived usage state, and its edit panel renders lock
hints for fields the domain freezes after first use (immutable code, and
balance behaviour once the leave type is referenced). Lock hints describe the
rule; the API remains authoritative.

New pages MUST reuse `AdministrationPageHeader`, `AdministrationPageBody`,
`AdministrativeGridToolbar`, `AdministrativeGridShell` (when tabular),
`GridPagination`, `FormField` / `formControlClassName`, shared button class
helpers, and `PortalDateInput` / `DateRangePicker` instead of inventing
parallel layout or control variants.

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
