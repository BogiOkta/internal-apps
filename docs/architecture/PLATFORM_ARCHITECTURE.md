# Internal Apps Platform — Platform Architecture

| Attribute | Value |
|---|---|
| Status | Canonical structural guide |
| Architecture style | Practical modular monolith |
| Governing standard | [`../PROJECT_INSTRUCTIONS.md`](../PROJECT_INSTRUCTIONS.md) |
| Detailed architecture | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| Applies to | Platform capabilities and every business application |

> This document defines the long-term structural rules for the Internal Apps Platform. It complements, but does not replace, the governing project standard and the detailed architecture, database, API, security, UI, domain, and module documents. If documents conflict, follow the precedence defined in `PROJECT_INSTRUCTIONS.md`.

## 1. Purpose and Status

This is the canonical implementation-oriented guide for deciding where platform code and data belong and how new business applications integrate.

Business applications drive platform evolution. Platform capabilities are added when a current workflow requires them, not because they may be useful later. Architecture changes MUST:

- preserve the modular-monolith baseline unless an approved ADR establishes a concrete need;
- solve a demonstrated business, maintenance, security, or operational problem;
- use the smallest structure that keeps ownership and dependencies clear;
- avoid speculative infrastructure, premature abstraction, and framework-driven design.

Detailed rules remain in:

- [`DATABASE.md`](DATABASE.md) for logical data ownership and migration policy;
- [`API_GUIDELINES.md`](API_GUIDELINES.md) for HTTP contracts;
- [`SECURITY.md`](SECURITY.md) for authentication, authorization, secrets, and database security;
- [`../standards/UI_GUIDELINES.md`](../standards/UI_GUIDELINES.md) for Portal implementation;
- domain and module documents for business-specific ownership.

## 2. Platform Structure

The deployable baseline is:

```text
Internal user
    ↓
Single Portal (Next.js, React, TypeScript)
    ↓ HTTPS / JSON
Shared API (ASP.NET Core, .NET 8)
    ↓ Dapper / parameterized SQL
PostgreSQL (schemas define ownership)
```

Structural rules:

- There is one shared Portal. User and administrative features use the same shell and deployment.
- There is one shared API boundary. Browsers and users never access PostgreSQL directly.
- PostgreSQL is the transactional system of record. Schemas separate domain ownership inside one database.
- DbUp runs ordered SQL migrations from `database/migrations`.
- Applied migrations are historical records and are immutable.
- Local configuration and secrets are loaded from untracked `.env` files.
- Real credentials, hosts, tokens, and connection strings MUST NOT enter source-controlled files.
- The private Git repository is the source of truth for implementation, migrations, documentation, and approved decisions.

Additional deployables or data stores require a current operational need and an ADR. Module count alone is not sufficient justification.

## 3. Domain Ownership

Every table, API capability, business rule, and write operation has one owner.

| Domain | Owns | Does not own |
|---|---|---|
| `identity` | Authentication, users, roles, permissions, application access, refresh tokens, login history | Employee business records or module workflows |
| `organization` | Employees, departments, and shared organizational master data added only when genuinely required | Payroll, recruitment, performance management, or a speculative full HR model |
| `vacation` | Leave types, leave requests, balances, holidays, and Vacation-specific approval data | Employees, departments, authentication, or generic platform authorization |

Organization is shared business master data, not a generic dumping ground and not a full HR system. Its current boundary is defined in [`../domain/organization.md`](../domain/organization.md).

Vacation consumes Organization contracts and references Organization records. It MUST NOT copy employee or department master data into the `vacation` schema. Its boundary is defined in [`../domain/vacation.md`](../domain/vacation.md).

The same rule applies to future applications:

```text
Identity
    ↓
Organization
    ↓
Vacation / Assets / Fleet / Help Desk / Approvals / Visitors / other applications
```

Shared master data is referenced or queried through its owning contract. It is never independently maintained in multiple application schemas.

## 4. Application Architecture

The preferred business-operation flow is:

```text
Endpoint
    → Application Service
        → Repository
            → PostgreSQL
```

### Endpoint

An endpoint owns HTTP concerns:

- route and method;
- authentication and declared authorization entry point;
- request parsing and transport validation;
- cancellation and request context;
- response DTO and HTTP status mapping;
- safe Problem Details responses.

Endpoints MUST NOT contain SQL, multi-step workflows, or substantial business logic. Resource-level and workflow authorization must not be reduced to a route-level check.

### Application Service

An application service owns a use case:

- business rules and business validation;
- orchestration across repositories or shared capabilities;
- permission-sensitive and resource-sensitive decisions;
- state transitions;
- transaction-boundary decisions;
- required audit and notification coordination.

Application services are use-case-specific classes, not a framework. A trivial read-only endpoint MAY call one owning repository directly when an application service would only forward identical arguments and results. Introduce the service as soon as rules, orchestration, authorization scope, or transaction behavior exists.

### Repository

A repository owns data access:

- explicit parameterized SQL;
- connection and command use;
- database-row materialization;
- persistence DTO to response/domain mapping;
- query ordering and bounded data retrieval.

Repositories MUST NOT contain HTTP behavior, UI decisions, permission workflows, or business state transitions.

Keep this structure lightweight. CQRS frameworks, MediatR, event buses, generic repository frameworks, and complex domain frameworks are not part of the baseline. They require a demonstrated business or operational need, documented alternatives, and approval.

## 5. API Rules

- Routes are versioned under `/api/v1`.
- Routes and DTOs use stable English contract names.
- API responses and routes expose opaque `publicId` values only.
- Internal numeric database IDs MUST NOT cross the API boundary.
- SQL is explicit and parameterized; client input never becomes raw SQL.
- Authentication is required unless an endpoint is explicitly documented as public.
- Server-side authorization is mandatory. Frontend visibility is only user experience.
- Response models are purpose-specific and stable; database row types are not API contracts.
- Search, filtering, and sorting accept documented parameters and explicit allowlists.
- Sort fields map to fixed repository expressions; arbitrary field names or operators are prohibited.
- Errors follow the Problem Details contract in `API_GUIDELINES.md`.
- Technical domain names stay in code and contracts where they clarify ownership, but are not unnecessarily exposed in user-facing labels or messages.

## 6. Database Rules

- Every table belongs to exactly one domain schema and has exactly one owner.
- Cross-domain logical references are allowed when ownership and lifecycle are documented.
- Direct cross-schema foreign keys follow the restrictions in `DATABASE.md`; they are not introduced casually between independent business domains.
- Shared data is referenced or read from its owner, not copied into consumer schemas.
- Applied migrations MUST NOT be edited, reordered, or deleted.
- Schema or reference-data changes use the next sequential migration.
- Migration scripts must be deterministic, reviewable, and safe for the supported upgrade path.
- Data-moving migrations must state and verify preservation assumptions.
- Multi-statement PostgreSQL migrations require an explicitly defined and validated DbUp transaction strategy.
- Runtime roles receive only the schema and table privileges required by implemented use cases.
- Read-only domain data remains read-only for the runtime role until an approved write use case exists.
- Owner/migration credentials are never used by the running API.
- Secrets, passwords, real server addresses, and connection strings MUST NOT appear in migrations or documentation.

Migration review includes clean application where supported, upgrade from the previous version, data preservation, constraints, indexes, permissions, locking impact, and forward recovery.

## 7. Repository Organization

| Area | Responsibility |
|---|---|
| `apps/api` | ASP.NET Core API, domain/module endpoints, application services, repositories, and shared runtime infrastructure |
| `apps/portal` | Single Next.js Portal, shared shell, application workspaces, typed services, localization, and UI |
| `database/migrations` | Ordered immutable DbUp SQL migrations |
| `tools` | Operational utilities such as the migrator and narrowly scoped administration tools |
| `docs` | Governing standards, architecture, ADRs, domains, modules, and operating instructions |

Backend domain code remains grouped under its owning domain or module, for example:

```text
apps/api/src/Api/Modules/Organization/
```

Portal business pages remain under their application routes and feature folders. Typed clients and types use the domain that owns the API contract, even when another workspace consumes them.

Shared technical code is extracted only when at least two real modules need the same stable behavior. Do not introduce a generic service, component, hook, repository base, or utility solely for possible future reuse. Authentication, authorization, error handling, and the application shell remain platform-owned shared capabilities.

## 8. Adding a New Business Application

Add a business application through one usable vertical slice at a time:

1. Define the business capability and its domain owner.
2. Separate shared master data from application-owned data.
3. Create or update the concise domain/module documentation.
4. Add the next sequential database migration when persistence changes.
5. Implement one API vertical slice: endpoint, application service when needed, repository, response model, authorization, and tests.
6. Implement the Portal workspace using the shared shell.
7. Add all user-visible text to the supported localization dictionaries with the UI feature.
8. Validate authentication, server authorization, public identifiers, least privilege, input handling, and sensitive-data exposure.
9. Run Release and production builds plus authenticated smoke tests.
10. Manually verify the UI workflow, accessibility, responsive behavior, and error states.
11. Synchronize architecture, API, database, domain, module, and run documentation.
12. Commit one focused, reviewable milestone.

A sprint should deliver one usable end-to-end capability. Avoid creating a complete schema, API surface, or UI framework before its first workflow needs it.

## 9. Portal and UX Architecture

The global application shell remains stable. It owns authentication resolution, global navigation, assigned applications, current-user context, localization control, responsive navigation, and logout.

Each business application owns only its internal workspace navigation and pages. It MUST NOT create another global shell, login flow, or administrator frontend.

Use this standard business-page hierarchy:

```text
Title and context
    → Command bar
        → Filters or secondary navigation
            → Main working surface
                → Optional right-side detail panel
```

UX rules:

- Prefer compact, readable business tables for collections.
- Prefer list-plus-detail-panel workflows when users need to retain context.
- Reserve cards for launchers and concise summaries.
- Avoid unnecessary modals, multi-step wizards, and dashboard-card-heavy CRUD screens.
- Use available screen width efficiently without creating uncontrolled page scrolling.
- Keep the primary action visible and place related commands predictably.
- Provide loading, empty, no-results, error, denied, and success states as applicable.
- Preserve keyboard operation, focus visibility, semantic structure, and accessible names.
- Add Serbian Latin and English translations with every UI feature; do not defer localization.

Detailed component, table, form, calendar, responsive, and accessibility rules remain in `UI_GUIDELINES.md`.

## 10. Security Principles

- Secrets remain in local untracked `.env` files or approved deployment secret stores.
- Credentials, tokens, connection strings, password hashes, and local environment files are never committed.
- The API is the only application data boundary to PostgreSQL.
- Server-side authorization is required for every protected operation and resource scope.
- Public UUIDs are used outside the database boundary; they are identifiers, not authorization.
- Database owner credentials are restricted to migrations and approved operations.
- Runtime database roles follow least privilege.
- Sensitive employee data is minimized and MUST NOT become broadly visible through shared APIs, tables, logs, or UI.
- Authentication, authorization, and other security events follow `SECURITY.md`.
- Audit requirements are designed and implemented with the write operations, approvals, assignments, and state transitions that require them.
- AI tools receive no secrets or production data.

## 11. Testing and Validation

The expected delivery flow is:

```text
implementation
    → review
    → migration
    → API Release build
    → Portal production build
    → authenticated smoke test
    → manual UI verification
    → git diff --check
    → secrets and generated-file audit
    → commit
    → optional version tag
    → push
```

Do not treat a successful build as a complete smoke test. Verify the intended running build, authenticated contracts, authorization failures, database state, and old-route removal when applicable.

Normal development commands are:

API:

```powershell
dotnet run --project apps/api/src/Api/InternalApps.Api.csproj --launch-profile http
```

Portal:

```powershell
cd apps/portal
npm run dev
```

Commands and documentation MUST NOT embed credentials. Before commit, remove temporary validation artifacts and revert generated-only tracked-file drift.

## 12. Explicit Non-Goals

The baseline explicitly excludes:

- microservices by default;
- Kubernetes;
- a message broker without a concrete delivery or integration need;
- a full HR platform;
- payroll;
- duplicated organizational master data;
- a generic workflow engine before a real workflow requires one;
- speculative shared abstractions;
- module-specific authentication systems or shells;
- unnecessary modal-heavy, wizard-heavy, or dashboard-card-heavy UI.

These are not permanent prohibitions where a proven requirement exists. Introducing one requires documented need, alternatives, operational ownership, and approval.

## 13. Architecture Decision Rule

Before introducing a new abstraction, shared component, infrastructure service, schema, framework, or deployable, answer:

1. Which current business requirement requires it?
2. Which existing duplication, security risk, maintenance burden, or operational problem does it solve?
3. Can the same outcome be delivered as a simpler vertical slice?
4. Does it improve maintainability for at least two real use cases?

If the answers are not specific and evidence-based, do not introduce it yet. Record consequential accepted decisions in an ADR and update the affected canonical documents before implementation.
