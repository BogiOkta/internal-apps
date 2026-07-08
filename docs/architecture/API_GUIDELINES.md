# Internal Apps Platform — API Guidelines

| Attribute | Value |
|---|---|
| Status | Implementation standard |
| Governing document | [`../PROJECT_INSTRUCTIONS.md`](../PROJECT_INSTRUCTIONS.md) |
| Related architecture | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| Security standard | [`SECURITY.md`](SECURITY.md) |
| Applies to | All ASP.NET Core API endpoints and clients |

> These guidelines define the HTTP conventions Codex must follow. They do not replace module specifications or the API rules in `PROJECT_INSTRUCTIONS.md`.

## 1. API Boundary

The API is the only application boundary to PostgreSQL and the authoritative location for validation, authorization, business rules, transactions, and audit.

All current routes begin with:

```text
/api/v1
```

Routes are grouped by module or Core capability:

```text
/api/v1/vacation/requests
/api/v1/vacation/leave-types
/api/v1/identity/users
/api/v1/core/notifications
```

`v1` is a contract version, not the application release number. Breaking changes require a new major API version and a migration/deprecation plan. Additive optional fields are normally handled within the current version after compatibility review.

## 2. REST Route Conventions

Use lowercase kebab-case path segments and plural resource nouns.

| Operation | Method and route |
|---|---|
| List resources | `GET /api/v1/vacation/requests` |
| Read resource | `GET /api/v1/vacation/requests/{publicId}` |
| Create resource | `POST /api/v1/vacation/requests` |
| Replace complete resource, when supported | `PUT /api/v1/vacation/requests/{publicId}` |
| Partially update resource, when supported | `PATCH /api/v1/vacation/requests/{publicId}` |
| Delete/soft-delete resource | `DELETE /api/v1/vacation/requests/{publicId}` |
| Execute a business command | `POST /api/v1/vacation/requests/{publicId}/approve` |

Rules:

- Do not use verbs such as `/getRequests` or `/createRequest`.
- Use a subordinate command only when the behavior is a real domain action, such as `approve`, `reject`, or `cancel`.
- Do not encode UI page names in routes.
- Do not expose schema, table, or repository names.
- Nested routes represent meaningful containment, not arbitrary joins.
- Keep route depth small; prefer resource identifiers and filters over deep nesting.

## 3. Endpoint Organization

Minimal API endpoint handlers are grouped by module and resource. A handler performs only:

1. binding and transport validation;
2. authentication/permission declaration;
3. application use-case invocation;
4. result-to-HTTP mapping;
5. OpenAPI metadata.

Handlers do not contain SQL, business calculations, transaction orchestration, or direct audit/notification persistence.

Each endpoint has:

- stable operation name;
- summary and description;
- documented request and response types;
- declared authentication and permission;
- documented success and error responses;
- tests for HTTP, authorization, and contract behavior.

## 4. DTO Conventions

Transport DTOs are distinct from database records and domain entities.

Use purpose-specific PascalCase names:

| Purpose | Naming form | Example |
|---|---|---|
| Create request body | `Create<Resource>Request` | `CreateLeaveRequestRequest` |
| Update request body | `Update<Resource>Request` | `UpdateLeaveRequestRequest` |
| Command request body | `<Action><Resource>Request` | `RejectLeaveRequestRequest` |
| Single response | `<Resource>Response` | `LeaveRequestResponse` |
| List item | `<Resource>ListItemResponse` | `LeaveRequestListItemResponse` |
| Page response | `PagedResponse<T>` | `PagedResponse<LeaveRequestListItemResponse>` |

Avoid ambiguous suffixes such as `Model`, `Data`, `Info`, and `Dto` when the transport purpose can be named precisely.

Request DTOs include only client-settable fields. They never accept:

- internal or public ID for a server-created resource;
- creator/updater identity;
- audit timestamps;
- permission or role claims;
- calculated balances or totals;
- workflow state controlled by business commands;
- company scope inferred from the actor, unless explicitly documented.

Response DTOs include only fields needed by the contract. They do not serialize database entities directly.

## 5. Identifiers

API contracts use only opaque public UUID identifiers named `publicId` in JSON and `{publicId}` in routes.

Internal database `id` values must never appear in:

- route parameters;
- request or response JSON;
- pagination cursors;
- error details;
- Portal URLs;
- OpenAPI examples.

Example response fragment:

```json
{
  "publicId": "2fb9e4ef-a58c-4ca4-9d40-4e4e91b99f26",
  "status": "pending"
}
```

Public identifiers do not authorize access. The use case must load the resource and apply the actor’s resource-level policy.

## 6. Validation

Validation occurs at three levels:

| Level | Examples | Owner |
|---|---|---|
| Transport | Required field, UUID format, string length, valid date format | Presentation/API |
| Business | Date order, leave overlap, available balance, valid state transition | Application/Domain |
| Persistence | Uniqueness, foreign key, concurrency, non-null invariant | PostgreSQL and repository mapping |

Rules:

- Validate every untrusted route, query, header, and body value.
- Reject unknown or forbidden fields where they create mass-assignment risk.
- Normalize only according to an explicit contract; do not silently “fix” business input.
- Use stable machine-readable validation codes.
- Return all useful independent field errors in one response.
- Never rely on frontend Zod validation as server validation.
- Map expected uniqueness and concurrency failures to safe conflict responses.

Field error paths use request JSON property names, for example `startDate`.

## 7. Error Responses

All errors use RFC 7807 Problem Details. The response content type is `application/problem+json`.

Required fields and extensions:

| Field | Purpose |
|---|---|
| `type` | Stable problem type URI or identifier |
| `title` | Short safe description |
| `status` | HTTP status code |
| `detail` | Safe actionable detail when appropriate |
| `instance` | Request path or request-specific reference |
| `code` | Stable application error code |
| `traceId` | Correlation identifier for support |
| `errors` | Field validation errors when applicable |

Example validation response:

```json
{
  "type": "https://internal-apps/problems/validation",
  "title": "Validation failed",
  "status": 400,
  "detail": "One or more fields are invalid.",
  "instance": "/api/v1/vacation/requests",
  "code": "validation_failed",
  "traceId": "00-7f2d...",
  "errors": {
    "startDate": ["Start date is required."],
    "endDate": ["End date must not be before start date."]
  }
}
```

Do not return stack traces, SQL, exception class names, secrets, internal IDs, or sensitive existence information. Unexpected exceptions are logged once at the handling boundary and returned as safe `500` Problem Details.

## 8. Status Codes

| Status | Use |
|---|---|
| `200 OK` | Successful read, update, or command with a response body |
| `201 Created` | Resource created; include `Location` |
| `204 No Content` | Successful operation with no response body |
| `400 Bad Request` | Malformed request or standard validation failure |
| `401 Unauthorized` | Missing, invalid, or expired authentication |
| `403 Forbidden` | Authenticated actor lacks permission |
| `404 Not Found` | Resource absent or intentionally concealed |
| `409 Conflict` | Concurrency, uniqueness, or invalid workflow-state conflict |
| `422 Unprocessable Content` | Documented business validation when deliberately distinguished from `400` |
| `429 Too Many Requests` | Rate limit exceeded |
| `500 Internal Server Error` | Unexpected failure |
| `503 Service Unavailable` | Temporary critical dependency/readiness failure |

Do not return `200` with an error body. Do not use `404` for validation. Choose either `400` or `422` consistently within a documented module contract.

## 9. Pagination, Filtering, and Sorting

Every potentially large collection is paginated.

### 9.1 Offset pagination

Use for bounded administrative and business lists:

```text
GET /api/v1/vacation/requests?page=1&pageSize=25
```

`page` is one-based. `pageSize` has a documented default and enforced maximum.

Standard response:

```json
{
  "items": [],
  "page": 1,
  "pageSize": 25,
  "totalCount": 0,
  "totalPages": 0
}
```

Return `totalCount` only where the UI needs it and the query cost is acceptable.

### 9.2 Cursor pagination

Use `cursor` and `limit` for high-volume or rapidly changing feeds. Cursors are opaque and must not expose internal IDs. Cursor responses contain the items and `nextCursor`; absence of `nextCursor` means there is no next page.

### 9.3 Filtering

Filters use explicit allowlisted parameters:

```text
GET /api/v1/vacation/requests?status=pending&requestedBy=2fb9e4ef-a58c-4ca4-9d40-4e4e91b99f26&fromDate=2026-07-01
```

Do not accept arbitrary SQL fields, operators, or expressions. Repeated parameters may represent multiple values only when documented.

### 9.4 Sorting

Use `sort` with documented contract field names. Prefix descending fields with `-`:

```text
GET /api/v1/vacation/requests?sort=-createdAt,startDate
```

Sorting fields are allowlisted and mapped to safe repository expressions. Every paginated result has deterministic ordering and a stable tie-breaker.

## 10. Authorization and Audit

Each protected endpoint declares one primary permission. Application use cases additionally enforce company, ownership, assignment, delegation, and workflow-state rules.

Vacation examples:

| Endpoint | Permission | Additional resource rule |
|---|---|---|
| `GET /vacation/requests` | `vacation.requests.read` | Scope results to records the actor may view |
| `POST /vacation/requests` | `vacation.requests.create` | Requester/company derived from actor |
| `POST /vacation/requests/{publicId}/approve` | `vacation.requests.approve` | Actor is eligible for current approval step |
| `POST /vacation/requests/{publicId}/cancel` | `vacation.requests.cancel` | Actor owns request or has elevated scope; state permits cancellation |

Every create, update, delete, restore, approval, rejection, cancellation, assignment, and other consequential write creates an audit event. The Application Layer supplies the action, actor context, target public ID, and safe change summary.

Required audit and business writes use the same transaction. Endpoint handlers do not write audit tables directly.

## 11. Vacation Endpoint Examples

Recommended initial contract surface:

```text
GET    /api/v1/vacation/leave-types
GET    /api/v1/vacation/public-holidays
GET    /api/v1/vacation/balances

GET    /api/v1/vacation/requests
POST   /api/v1/vacation/requests
GET    /api/v1/vacation/requests/{publicId}
PATCH  /api/v1/vacation/requests/{publicId}
POST   /api/v1/vacation/requests/{publicId}/submit
POST   /api/v1/vacation/requests/{publicId}/approve
POST   /api/v1/vacation/requests/{publicId}/reject
POST   /api/v1/vacation/requests/{publicId}/cancel

GET    /api/v1/vacation/approvals
```

These examples establish naming, not undocumented functionality. The canonical Vacation module specification determines which operations exist and their exact contracts.

Example creation:

```http
POST /api/v1/vacation/requests
Content-Type: application/json
Authorization: Bearer <access-token>
```

```json
{
  "leaveTypePublicId": "80e69ee5-c4a4-4ba1-b988-92ac0b68eea7",
  "startDate": "2026-08-10",
  "endDate": "2026-08-14",
  "comment": "Annual leave"
}
```

The server derives the requester, company, initial state, calculated duration, audit metadata, and applicable approval workflow.

## 12. OpenAPI

Every endpoint must appear in generated OpenAPI documentation with:

- operation ID;
- summary and module tag;
- route, query, and request-body schema;
- success response schema;
- documented Problem Details responses;
- authentication requirement;
- public UUID/date examples;
- deprecation metadata when applicable.

OpenAPI must describe actual runtime behavior. Contract changes update OpenAPI, module documentation, tests, and Portal types/usage in the same pull request.

OpenAPI generation is verified in CI. Undocumented endpoints, duplicate operation IDs, or schema generation failures block merge.

## 13. Date, Time, Concurrency, and Idempotency

- Instants use ISO 8601 UTC, for example `2026-07-08T13:45:00Z`.
- Date-only values use `YYYY-MM-DD`.
- Business time zones are explicit and never inferred from server local time.
- Concurrently editable resources expose a version or ETag according to their contract.
- Stale writes return `409` or `412` consistently.
- Retried operations that could create duplicate business effects require an idempotency strategy.

## 14. Implementation Checklist

- [ ] Route begins with `/api/v1` and uses plural kebab-case resources.
- [ ] Handler is thin and calls one application use case.
- [ ] Request and response DTOs are purpose-specific.
- [ ] Only `publicId` values cross the API boundary.
- [ ] Transport and business validation are implemented server-side.
- [ ] Errors use safe RFC 7807 Problem Details.
- [ ] Collections are bounded, paginated, filtered, and sorted through allowlists.
- [ ] Authentication, permission, and resource-scope rules are tested.
- [ ] Consequential writes create atomic audit events.
- [ ] Status codes match the table above.
- [ ] OpenAPI and module documentation match runtime behavior.
