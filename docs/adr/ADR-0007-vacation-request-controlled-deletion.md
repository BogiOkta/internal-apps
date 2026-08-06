# ADR-0007: Controlled Administrative Hard Deletion of Vacation Requests

## Status

Approved architecture — pending bounded implementation.

No part of this decision is implemented. No migration, API endpoint, permission,
database function, or Portal control described here exists in the repository at
the time of writing. Implementation proceeds only through the bounded increments
in section 14, and the documentation updates in section 15 are applied with the
increment that makes each statement true.

## Date

2026-08-06

## Owners

- Vacation module owner
- Platform architecture owner

## Context

`vacation.leave_requests` is the Vacation workflow root. Its documented MVP
behavior has no physical delete: `docs/domain/vacation.md` states "There is no
draft and no physical deletion", and migration `017_vacation_runtime_grants.sql`
grants the runtime role no `DELETE` on `vacation.leave_requests`,
`vacation.leave_request_history`, or `vacation.leave_balances`.

Operational experience has produced a legitimate administrative need: an
operator must be able to remove a leave request document that should never have
existed in the operational model (mistaken administrative absence entry or a
duplicate record captured before validation was tightened). Today
the only available outcome is cancellation, which leaves a permanent operational
row that pollutes lists, filters, calendars, and the employee's own view.

At the same time, three properties must not be weakened:

1. `vacation.leave_balance_entries` is append-only ledger evidence
   (migration 020: `SELECT, INSERT` only, plus an
   `UPDATE OR DELETE` rejection trigger). ADR-0005 §12 and ADR-0006 fix
   append-only immutability as a business invariant.
2. `audit.audit_events` is append-only central evidence; business deletion never
   cascades into audit deletion (`DATABASE.md` §6.3).
3. Ledger entries derived from a request carry the request's **internal bigint
   key** in two places: `leave_request_id` and, by check constraint,
   `source_reference = leave_request_id::text`. Migration 020's
   `ck_vacation_leave_balance_entries_cause_shape` makes that textual equality a
   database invariant, and `uq_vacation_leave_balance_entries_kind_source` makes
   it the idempotency key. That numeric value can therefore never be reused or
   re-issued for a different request.

Two established repository patterns are directly relevant:

- **Controlled deletion.** Organization employees (migrations 023–029),
  Organization departments (migration 030), and Vacation leave types
  (migration 032) are physically deletable only through owner-owned
  `SECURITY DEFINER` functions with locked-down `search_path`; the runtime role
  holds no table `DELETE`, and dependent rows never cascade. Conflicts are
  reported through a versioned internal message token
  (`<entity>_delete_conflict:v1:<label>|<label>`) parsed against a fixed API-side
  allowlist.
- **Permanent dependency markers.** `organization.employee_protected_dependencies`
  (migrations 025–029) records, permanently and by owner-only trigger, that an
  employee has ever acquired a protected dependency. Later removal of a mutable
  dependent row cannot make a formerly referenced employee deletable.

Vacation has no equivalent permanent-identity or permanent-marker mechanism for
requests, and the current ledger integrity trigger does not defend against a
missing operational request. Both gaps must be closed **before** any deletion
capability exists.

## Decision

Vacation adopts **controlled administrative hard deletion of the operational
leave-request document only**, under a permanent-identity model.

The approved principle, restated normatively:

1. The operational leave request (`vacation.leave_requests`) MAY be physically
   removed by an explicitly permissioned, reasoned, audited administrative
   command.
2. Its immutable ledger evidence (`vacation.leave_balance_entries`) and central
   audit evidence (`audit.audit_events`, `audit.audit_details`) remain
   permanently and are never updated, deleted, rewritten, or anonymized by this
   capability.
3. Deletion never performs cancellation and never neutralizes a balance. It
   posts no ledger entry, reverses nothing, and mutates no
   `vacation.leave_balances` value.
4. When a business effect is active, the administrator MUST first execute the
   existing cancel command as a separate permissioned and audited operation.
   Deletion is a second, independent decision.
5. Deletion is allowed only when the request is terminal **and** its
   request-scoped ledger net effect is exactly zero.
6. No `ON DELETE CASCADE` is introduced anywhere in this design.
7. No ledger row is updated or deleted.
8. No runtime table `DELETE` grant is introduced on any Vacation table.

This is **administrative removal from the operational model**. It is explicitly
not privacy erasure, not anonymization, and not a right-to-be-forgotten
mechanism. The employee, leave type, quantities, dates, actor, reason, and
balance effect of the deleted document remain fully reconstructable from ledger
and audit evidence.

---

## 1. Permanent request identity

### 1.1 Entity

A new Vacation-owned table retains the permanent identity of every leave request
that has ever existed.

| Attribute | Type | Rule |
|---|---|---|
| `id` | `bigint`, primary key, `GENERATED BY DEFAULT AS IDENTITY` | The permanent numeric request identity. Values are never reused. `BY DEFAULT` (not `ALWAYS`) exists solely so the backfill can preserve every existing `vacation.leave_requests.id`. |
| `public_id` | `uuid NOT NULL DEFAULT gen_random_uuid()`, unique | The permanent public request identifier used by the API, audit, and Portal links. |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | When the identity was first issued. |

Additional constraints:

- `CONSTRAINT uq_vacation_leave_request_identities_public_id UNIQUE (public_id)`;
- `CONSTRAINT uq_vacation_leave_request_identities_id_public_id UNIQUE (id, public_id)`
  — the composite key that lets the operational row prove it carries the same
  public identifier;
- an owner-owned `BEFORE UPDATE OR DELETE` trigger
  (`vacation.prevent_leave_request_identity_mutation()`) that unconditionally
  raises. Identity rows are permanent and immutable even for the owner role;
  correcting one requires a reviewed migration that drops and recreates the
  trigger explicitly.

Runtime grants: `SELECT` and table-level `INSERT` (no column list, so the
identity may be created with `DEFAULT VALUES`), plus `USAGE` on its identity
sequence. Never `UPDATE`, never `DELETE`.

### 1.2 Relationship to the operational document

`vacation.leave_requests` remains the operational document and references the
permanent identity **one-to-one through its own primary key**:

- `vacation.leave_requests.id` drops its `GENERATED ALWAYS AS IDENTITY` property
  and becomes a plain `bigint` primary key whose value is allocated by
  `vacation.leave_request_identities`;
- `CONSTRAINT fk_vacation_leave_requests_identity FOREIGN KEY (id, public_id)
  REFERENCES vacation.leave_request_identities (id, public_id) ON DELETE NO ACTION`.

The composite foreign key is deliberate. It enforces one-to-one cardinality
(the operational primary key cannot duplicate an identity) **and** guarantees
that `leave_requests.public_id` can never diverge from the permanent
`leave_request_identities.public_id`. `leave_requests.public_id` is retained as
a compatibility column so that no existing repository SQL, projection, or index
changes in this increment; reading the public identifier from the identity table
instead is deferred indefinitely. This avoids an unnecessary contract and query
refactor while the composite relationship continues to prevent divergence.

Creation path after the change (one statement, one transaction):

```sql
WITH new_identity AS (
    INSERT INTO vacation.leave_request_identities
    DEFAULT VALUES
    RETURNING id, public_id
)
INSERT INTO vacation.leave_requests (id, public_id, employee_id, ...)
SELECT new_identity.id, new_identity.public_id, ...
FROM new_identity
RETURNING ...;
```

This requires one added column grant, `INSERT (id, public_id)` on
`vacation.leave_requests`, because those columns were previously server-generated.

### 1.3 Backfill

The backfill preserves every existing numeric value exactly:

```sql
INSERT INTO vacation.leave_request_identities (id, public_id, created_at)
SELECT id, public_id, created_at FROM vacation.leave_requests;

SELECT setval(
    pg_get_serial_sequence('vacation.leave_request_identities', 'id'),
    GREATEST((SELECT coalesce(max(id), 0) FROM vacation.leave_request_identities), 1));
```

Preserving `id` is mandatory, not cosmetic: `leave_balance_entries.source_reference`
already stores `leave_request_id::text` and is enforced by check constraint. Any
renumbering would break both that constraint and posting idempotency.

The old `vacation.leave_requests_id_seq` is left in place, unused, and removed
only by a later contraction migration once no supported code path references it.

### 1.4 Evidentiary repointing

`vacation.leave_balance_entries.leave_request_id` drops its foreign key to
`vacation.leave_requests` and gains:

```sql
CONSTRAINT fk_vacation_leave_balance_entries_request_identity
    FOREIGN KEY (leave_request_id)
    REFERENCES vacation.leave_request_identities (id)
    ON DELETE NO ACTION
```

Ledger evidence therefore survives operational deletion with full referential
integrity, and the permanent identity can never be removed or reissued, so a
ledger entry can never become ambiguous or be silently reattached to a different
request.

`vacation.leave_request_history.leave_request_id` **keeps** its foreign key to
`vacation.leave_requests` with `ON DELETE NO ACTION`. History is operational
child data of the operational document and is deleted with it, by explicit
ordered statements inside the controlled function — never by cascade.

### 1.5 Prevention of reuse and ambiguity

- Identity rows are never deleted, so `max(id)` never regresses and the identity
  sequence never re-issues a used value.
- `public_id` is unique across the permanent identity table, so a deleted
  request's public identifier can never be assigned to a new request.
- Audit target identifiers and ledger `source_reference` values therefore remain
  permanently unambiguous.

---

## 2. Ledger integrity hardening

`vacation.enforce_leave_balance_entry_integrity()` (migration 020) currently
contains a latent defect that becomes a real hole once the operational request
can disappear:

```sql
SELECT * INTO request_record
FROM vacation.leave_requests
WHERE id = NEW.leave_request_id;

IF request_record.employee_id <> NEW.employee_id
   OR request_record.leave_type_id <> NEW.leave_type_id
   OR extract(year FROM request_record.date_from) <> NEW.leave_year THEN
    RAISE EXCEPTION ...;
END IF;
```

When no row is found, `request_record` is all-`NULL`, every comparison evaluates
to `NULL`, the `IF` is not taken, and the scope check silently passes. The same
nullable-comparison behavior weakens the `request_consumption` and
`cancellation_reversal` status checks.

The function is forward-upgraded by `CREATE OR REPLACE` to:

1. **Explicitly reject a missing operational request.** Immediately after the
   `SELECT ... INTO`, `IF NOT FOUND THEN RAISE EXCEPTION 'Leave balance entries
   require an existing operational leave request.'; END IF;`
2. **Stop relying on nullable comparison behavior.** Every cross-record
   comparison uses `IS DISTINCT FROM`, so a `NULL` on either side fails closed.
3. **Retain every existing invariant check**, unchanged in meaning: the
   balance-consuming Leave Type check, the request scope check, the approved
   status and exact-negation rules for `request_consumption`, the cancelled
   status and exact-reversal rules for `cancellation_reversal`, and the
   non-negative resulting balance. The advisory lock, its key shape, and the
   trigger binding are unchanged.
4. **Prohibit new request-derived ledger entries after document deletion.** This
   is the direct consequence of (1): once the operational request row is gone,
   no `request_consumption` or `cancellation_reversal` entry referencing that
   permanent identity can ever be inserted again, even though the FK now targets
   the permanent identity table.

Credit-side entries (`annual_entitlement`, `carry_over`, `manual_adjustment`)
have `leave_request_id IS NULL` by check constraint and are unaffected.

This hardening ships **before** any deletion capability exists.

---

## 3. Deletion eligibility

An operational leave request is deletable only when **both** conditions hold,
evaluated under lock inside the controlled function:

1. **Terminal status.** `status IN ('REJECTED', 'CANCELLED')`.
2. **Zero request-scoped ledger net effect.**
   `coalesce(sum(quantity_days), 0) = 0` over all
   `vacation.leave_balance_entries` whose `leave_request_id` equals the
   permanent request identity.

Consequences of that rule:

- `SUBMITTED` requests are never deletable. They hold an active workflow effect
  and an exclusion-constraint reservation.
- `APPROVED` requests are never deletable. They hold an active balance effect.
- Deletion never invokes cancellation. When the request is `APPROVED`, the
  administrator MUST first execute the existing
  `POST /api/v1/vacation/requests/{requestId}/cancel` command, which is
  separately permissioned (`vacation.requests.manage`), separately audited, and
  posts the exact linked `cancellation_reversal`. Only after that transaction
  commits does the request become eligible.
- A `CANCELLED` request that consumed balance nets to zero because consumption
  and its exact reversal cancel out; it is therefore eligible.
- A `REJECTED` request never posted a ledger entry; its net effect is the empty
  sum, zero, and it is eligible.
- If ledger entries remain with a non-zero net effect — which under current
  rules should be unreachable and indicates a defect or an unfinished
  compensation — deletion is refused with a stable `409`. It is never "fixed" by
  posting a compensating entry.

The net-effect check is deliberately computed over the **request scope**
(`leave_request_id`), not the balance scope (employee + leave type + year). The
question is whether this document still contributes anything to any balance, not
whether the employee's balance happens to be zero.

---

## 4. Controlled database function

### 4.1 Signature and security

```sql
vacation.delete_neutralized_leave_request(p_request_public_id uuid)
RETURNS TABLE (
    employee_public_id   uuid,
    leave_type_public_id uuid,
    leave_type_code      text,
    date_from            date,
    date_to              date,
    working_days         integer,
    previous_status      text,
    source               text,
    ledger_net_effect    numeric,
    deleted_history_rows integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
```

- Owned by `internal_apps_owner` (`ALTER FUNCTION ... OWNER TO internal_apps_owner`).
- `REVOKE ALL ... FROM PUBLIC`; `GRANT EXECUTE ... TO internal_apps_app`.
- The runtime role receives **no** `DELETE` on `vacation.leave_requests` or
  `vacation.leave_request_history`. Execution of this function is the only
  deletion path, exactly as with employees, departments, and leave types.
- The function returns the facts the API needs for its audit event, captured
  under the same lock as the delete, so the audit record cannot describe a
  different state than the one deleted.
- The **reason is not a function parameter**. The database function performs
  eligibility and deletion; the reason is validated by the API and persisted in
  the central audit event within the same transaction. This avoids storing the
  same operator text in two places and keeps the function's contract minimal.
  (The "fixed reason allow-list" requirement is satisfied by the closed conflict
  **token** allow-list in §4.3, which is the only reason text the database
  produces.)

### 4.2 Ordered behavior

1. Lock the operational request:
   `SELECT ... FROM vacation.leave_requests WHERE public_id = p_request_public_id FOR UPDATE`.
   If not found, `RETURN` without rows — the API maps an empty result to `404`.
2. Take the **same advisory lock used by ledger posting**, with the identical key
   shape from migration 020:
   `PERFORM pg_advisory_xact_lock(hashtextextended(format('%s:%s:%s', v_employee_id, v_leave_type_id, v_leave_year), 0))`
   where `v_leave_year = extract(year FROM v_date_from)::int`. This serializes
   deletion against concurrent ledger posting in the same balance scope.
3. Re-read status and recompute the request-scoped ledger sum **under both
   locks**. Never trust a pre-lock read.
4. If status is not terminal, raise
   `leave_request_delete_conflict:v1:non_terminal_status`.
5. If the ledger net effect is non-zero, raise
   `leave_request_delete_conflict:v1:ledger_effect_not_zero`.
6. Capture the audit facts (employee public id, leave type public id and code,
   date range, working days, previous status, source, ledger net effect).
7. `DELETE FROM vacation.leave_request_history WHERE leave_request_id = v_id;`
   and capture the affected row count with `GET DIAGNOSTICS`.
8. `DELETE FROM vacation.leave_requests WHERE id = v_id;`
9. `RETURN NEXT` the captured row.

The two deletes are explicit, ordered, and restricted by primary/foreign key to
this one request. The function touches no other table: not
`vacation.leave_balance_entries`, not `vacation.leave_balances`, not
`vacation.leave_policies`, not `vacation.leave_types`, not
`vacation.leave_request_identities`, not `audit.*`, not `organization.*`, not
`identity.*`.

### 4.3 Conflict tokens

Grammar: `leave_request_delete_conflict:v1:<token>(|<token>)*`, raised with
`ERRCODE = 'P0001'`, following migrations 028/030/032.

Fixed token allow-list — the API accepts these and nothing else:

| Token | Meaning | API mapping |
|---|---|---|
| `non_terminal_status` | Request is `SUBMITTED` or `APPROVED`. | `409 vacation_request_not_terminal` |
| `ledger_effect_not_zero` | Request-scoped ledger sum is not exactly zero. | `409 vacation_request_ledger_effect_not_zero` |
| `protected_dependency` | An unhandled operational dependency blocked the delete (raised from the `foreign_key_violation` handler). | `409 vacation_request_delete_conflict` |

A missing, malformed, redacted, or unknown token yields the generic safe `409`
conflict response. PostgreSQL detail, `SQLSTATE`, constraint names, object
names, and exception metadata never reach the client.

The `EXCEPTION WHEN foreign_key_violation` handler is the forward-compatibility
guard: if a future table references `vacation.leave_requests` and the function
is not updated to handle it, the delete fails safely with
`protected_dependency` instead of succeeding partially.

### 4.4 Transaction

The API opens one connection and one transaction, calls the function, writes the
audit event through the shared `AuditWriter`, and commits. The advisory lock is
transaction-scoped, so it is held until that commit. If audit persistence fails,
the whole transaction rolls back and the request is not deleted — the platform's
standing rule that required audit and the business write are atomic
(`PROJECT_INSTRUCTIONS.md` §12, `DATABASE.md` §16.2).

---

## 5. Permanent leave-type dependency protection

### 5.1 New marker table

`vacation.leave_type_protected_dependencies`, modeled directly on
`organization.employee_protected_dependencies` in its migration-026 labeled
form:

| Column | Rule |
|---|---|
| `leave_type_id` | `bigint`, FK to `vacation.leave_types (id)` `ON DELETE NO ACTION` |
| `dependency_name` | `text NOT NULL`, trimmed and non-blank by check constraint |
| `first_recorded_at` | `timestamptz NOT NULL DEFAULT now()` |

Primary key `(leave_type_id, dependency_name)`. `REVOKE ALL ... FROM PUBLIC,
internal_apps_app` — the runtime role cannot read, write, or delete markers.

An owner-owned `SECURITY DEFINER` trigger function
`vacation.remember_leave_type_protected_dependency()` takes declarative
arguments (`leave_type_id` column name, reference kind `id`, dependency label)
and performs `INSERT ... ON CONFLICT DO NOTHING`. Triggers are attached
`AFTER INSERT OR UPDATE OF leave_type_id` on:

| Table | Dependency label |
|---|---|
| `vacation.leave_requests` | `Vacation leave request` |
| `vacation.leave_balances` | `Vacation leave balance` |
| `vacation.leave_balance_entries` | `Vacation leave balance entry` |

Labels intentionally reuse the exact strings already in the migration-032
`ControlledDependencyNames` allowlist, so the API-side contract and the
localized Portal message are unchanged.

Existing usage is backfilled by `UNION` over the same three tables. Markers are
never removed. No delete trigger, no cleanup job, no runtime privilege.

### 5.2 Upgraded leave-type delete function

`vacation.delete_unreferenced_leave_type(uuid)` is forward-upgraded by
`CREATE OR REPLACE` to consult `vacation.leave_type_protected_dependencies`
instead of live `EXISTS` checks against the three tables. The emitted token
grammar and label allowlist are unchanged, so the API and Portal need no change
for this part.

This closes the exact hole the request-deletion capability would otherwise open:
after the last leave request referencing a leave type is deleted, a live
`EXISTS` check would report the type as unreferenced and permit its physical
deletion, silently orphaning the meaning of retained ledger and audit evidence.
With permanent markers, a leave type that has **ever** been used by a request is
permanently undeletable.

### 5.3 Existing employee markers — confirmation

**Confirmed: existing employee dependency markers already cover request deletion
safely, with no change required.**

`organization.employee_protected_dependencies` rows are inserted by
`AFTER INSERT OR UPDATE OF employee_id` triggers on
`vacation.leave_requests`, `vacation.leave_balances`, `vacation.leave_policies`,
`vacation.leave_balance_entries`, `core.user_employee_links`, and
`audit.audit_events` (migrations 025/026). There is no delete trigger, the
marker table grants nothing to `internal_apps_app`, and
`organization.delete_unreferenced_employee(uuid)` reads the marker table rather
than live dependents (migration 025), with employee foreign keys retained only
as defense in depth (`DATABASE.md` §7.1). Deleting a leave request therefore
cannot remove the `Vacation leave request` marker, and the affected employee
remains permanently undeletable. The retained ledger entry independently
preserves its own `Vacation leave balance entry` marker and employee foreign key.

Increment 1 nevertheless includes a focused regression test asserting exactly
this: after a controlled request deletion, the employee's marker rows are
unchanged and `organization.delete_unreferenced_employee` still conflicts.

---

## 6. System leave types

`vacation.leave_types` gains `is_system boolean NOT NULL DEFAULT false`.

It is set `true` for the canonical seeded codes established by migrations 006
and 016 — `ANNUAL_LEAVE`, `PAID_LEAVE`, `UNPAID_LEAVE`, `SICK_LEAVE`, `OTHER` —
by an idempotent `UPDATE ... WHERE code IN (...)`.

Rules:

- A system leave type can never be physically deleted.
  `vacation.delete_unreferenced_leave_type(uuid)` checks `is_system` **first**,
  before dependency markers, and raises
  `leave_type_delete_conflict:v1:System leave type`, extending the existing
  label allowlist with that one additional controlled label.
- A system leave type may still be deactivated and reactivated exactly where
  current behavior allows it. `is_active` semantics are unchanged.
- The runtime application cannot set `is_system`. Because migration 006 grants
  are column-level, it suffices to grant neither `INSERT (is_system)` nor
  `UPDATE (is_system)`. Types created through the API therefore always default
  to `false`. Changing the flag requires a reviewed migration.
- `is_system` is exposed read-only in the leave-type details/list projection so
  the Portal can explain why deletion is unavailable.

---

## 7. Permissions

Two dedicated permissions are seeded, each assigned initially only to the
existing `Administrator` role, using the idempotent pattern of migrations 031
and 035:

| Permission | Protects |
|---|---|
| `vacation.requests.delete` | The administrative request-deletion command only. |
| `vacation.leave-types.delete` | Physical leave-type deletion only. |

`*.manage` permissions are **not** reused. Destructive removal of an operational
document is a materially different capability from workflow administration, and
separating it allows a future role to administer requests without being able to
delete them (`PROJECT_INSTRUCTIONS.md` §7: privileged operations stay separately
permissioned).

Compatibility note: `DELETE /api/v1/vacation/leave-types/{publicId}` currently
requires `vacation.leave-types.manage`. Moving it to
`vacation.leave-types.delete` is an approved intentional authorization
narrowing. The new permission is initially assigned only to Administrator. The
change must be recorded in `SECURITY.md` and `API_GUIDELINES.md` and validated
with a denial test.

**Token refresh:** after the permission migration is applied, existing
Administrator access tokens do not contain the new permission claims. Tokens
must be refreshed or the user must sign in again before the delete commands
become available, matching the recorded behavior for migrations 008, 009, 010,
031, and 035. This must be recorded under "Known limitations" in
`PLATFORM_STATE.md` when the increment lands.

---

## 8. API contract

### 8.1 Recommendation

**Adopt `POST /api/v1/vacation/requests/{requestId}/delete`** as an explicit
destructive command. Reject `DELETE /api/v1/vacation/requests/{id}` with a
required JSON body.

| Criterion | `DELETE` with required body | `POST .../delete` |
|---|---|---|
| `API_GUIDELINES.md` §2 | Lists `DELETE /{publicId}` for "delete/soft-delete resource"; every existing platform `DELETE` route (leave types, departments, non-working days) is bodyless. A body-bearing `DELETE` would create a second, inconsistent `DELETE` convention. | §2 explicitly permits "a subordinate command only when the behavior is a real domain action", exactly as `approve`, `reject`, and `cancel` already do on this same resource. |
| HTTP semantics (§10.3 of `PROJECT_INSTRUCTIONS.md`) | `DELETE` is expected to be idempotent. This command is not: the second call returns `404`, and each accepted call is a distinct reasoned, audited business event. | `POST` is defined for non-idempotent commands. |
| Infrastructure behavior | RFC 9110 gives `DELETE` request bodies no defined semantics; proxies, gateways, and some HTTP clients may drop or refuse them. ASP.NET Core minimal APIs require explicit `[FromBody]` binding for `DELETE`, and OpenAPI/Swagger tooling renders `DELETE` request bodies inconsistently, which conflicts with the §12 requirement that OpenAPI describe actual runtime behavior. | Fully supported end to end: shared Portal typed client, minimal-API binding, OpenAPI schema, and contract tests all behave conventionally. |
| Consistency with the Vacation module | Would place the only reason-carrying destructive verb outside the established command family. | Sits beside `/approve`, `/reject`, `/cancel`, and `/record` on the same route prefix, with the same permission-declaration and audit shape. |

The decisive argument is the combination of the required reason (a body is
mandatory, not optional) and non-idempotency. Both point away from `DELETE`.
Leave-type deletion keeps its existing bodyless `DELETE` route; it carries no
reason, so nothing forces it to change shape.

### 8.2 Contract

```http
POST /api/v1/vacation/requests/{requestId}/delete
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{ "reason": "Duplicate administrative entry recorded in error." }
```

- Permission: `vacation.requests.delete`.
- `requestId` is the permanent public UUID. A malformed UUID does not match the
  `{requestId:guid}` route constraint and receives the framework route-level
  `404`, consistent with the documented leave-type behavior.
- `reason` is required, trimmed, and must be 1–500 characters after trimming.
  It is the only client-settable field. Request DTO:
  `DeleteLeaveRequestRequest`.
- Success: `204 No Content`.
- The command is not idempotent; a repeated call returns `404`.

### 8.3 Problem Details codes

All errors use RFC 7807 with the standard extension fields (`code`, `traceId`,
`instance`, and `errors` where applicable).

| Condition | Status | `code` |
|---|---|---|
| Request not found (unknown or already deleted public ID) | `404` | `vacation_request_not_found` |
| Non-terminal request (`SUBMITTED` or `APPROVED`) | `409` | `vacation_request_not_terminal` |
| Non-zero request-scoped ledger effect | `409` | `vacation_request_ledger_effect_not_zero` |
| Protected dependency conflict (unhandled operational dependent) | `409` | `vacation_request_delete_conflict` |
| System leave type (leave-type deletion) | `409` | `leave_type_system_protected` |
| Validation failure (missing/blank/oversized reason) | `400` | `validation_failed`, with `errors.reason` |

`vacation_request_not_terminal` responses SHOULD carry a safe `detail` directing
the operator to cancel the request first. No response reveals SQL, constraint
names, internal identifiers, or exception text.

---

## 9. Audit

Central audit is permanent and is never touched by deletion. The business
deletion and its audit event commit in the same transaction.

For every successful request deletion the audit event retains at minimum:

| Fact | Source |
|---|---|
| Actor | Authenticated user public ID from the actor context |
| Timestamp | Audit event occurrence time |
| Reason | Trimmed operator reason (1–500 chars) |
| Permanent request public ID | Audit target public ID; target type `vacation_request` |
| Employee | Employee public ID returned by the controlled function |
| Leave type | Leave type public ID and stable code |
| Date range | `date_from`, `date_to` |
| Working days | Persisted `working_days` |
| Previous terminal status | `REJECTED` or `CANCELLED` |
| Source | `EMPLOYEE_REQUEST` or `ADMINISTRATIVE_ENTRY` |
| Ledger net effect at deletion | The value verified under lock (always `0`) |
| Number of history rows deleted | `GET DIAGNOSTICS` row count |

Action name: `vacation.request.delete`. All facts are captured by the controlled
function under lock, so the audit record cannot describe a state other than the
one deleted.

Deliberately **not** stored: employee or decision notes, employee personal
details beyond the public identifier, or any copy of the deleted history rows.
The retained ledger entries and prior audit events already explain the request's
balance history; duplicating free-text notes into the deletion event would add
sensitive payload without adding evidentiary value
(`PROJECT_INSTRUCTIONS.md` §12, `SECURITY.md` §7).

**Classification.** This capability is administrative removal from the
operational model. It is not privacy erasure and not anonymization. The
employee, leave type, dates, quantities, actors, and balance effects of a
deleted request remain permanently visible in ledger and audit evidence. A
genuine erasure or anonymization requirement would be a separate, separately
authorized retention process under `PROJECT_INSTRUCTIONS.md` §23, and would
require its own ADR.

---

## 10. Reporting and operational consequences

**Operational presentation.** After a successful deletion, the request is
absent from both employee and administration operational views, including
lists, details, calendars, and operational history. No tombstone request row is
introduced. The permanent numeric and public identities remain, ledger evidence
remains, and central audit evidence remains. Audit functionality is the retained
administrative record. This is administrative removal from the operational
model, not privacy erasure.

**Ledger history display.** `vacation.leave_balance_entries` rows for a deleted
request remain complete: kind, signed quantity, effective date, reason, actor,
`leave_request_id`, and `source_reference`. Only the operational join target is
gone. Ledger history reads MUST therefore use a `LEFT JOIN` to
`vacation.leave_requests` and render a stable "request document removed" state
rather than dropping the row or failing. The permanent request public ID remains
resolvable through `vacation.leave_request_identities`.

**Reports.** No report may assume that every permanent request identity resolves
to an operational request. Any query joining `leave_balance_entries` (or a
future evidentiary table) to `leave_requests` with an inner join silently
under-reports after the first deletion. This is a review checklist item for
every Vacation reporting query.

**Balance recalculation is unchanged.** The authoritative balance is the signed
sum of ledger entries in the employee + leave type + year scope (ADR-0005 §4,
ADR-0006). Deletion adds and removes no entry, so every derived balance,
compatibility-mirror value, and history projection is bit-for-bit identical
before and after.

**Source-reference idempotency remains safe.** `source_reference` for
request-derived entries is the permanent numeric identity as text, and
`uq_vacation_leave_balance_entries_kind_source` is unchanged. Because permanent
identities are never deleted or reissued, no future request can ever collide
with a deleted request's source reference.

**Re-inserting ledger entries for a deleted request is prohibited.** The
hardened integrity trigger (§2) rejects any `request_consumption` or
`cancellation_reversal` whose operational request no longer exists. There is no
supported path — API, repository, or SQL — to post further request-derived
effects for a deleted document.

**Recovery.** PostgreSQL point-in-time recovery is the only recovery mechanism
for a deleted operational document and its history rows. There is no soft
delete, no recycle bin, and no undelete command. Restoring one request requires
a designed reconciliation procedure against a PITR copy, because the live
database will have advanced (`DATABASE.md` §18.3). Operators MUST be told this
in the Portal confirmation copy.

---

## 11. Forward-compatibility rule (mandatory)

Every future table whose rows reference a Vacation leave request MUST be
classified, in its migration and in module documentation, as exactly one of:

| Classification | Meaning | Foreign key target | Delete behavior |
|---|---|---|---|
| **Operational dependency** | The row is part of the operational document and has no evidentiary value once the document is removed. | `vacation.leave_requests (id)` | `ON DELETE NO ACTION` / `RESTRICT`, and the row MUST be deleted by an explicit, ordered statement inside `vacation.delete_neutralized_leave_request`. |
| **Evidentiary dependency** | The row is permanent evidence that must survive document removal. | `vacation.leave_request_identities (id)` | `ON DELETE NO ACTION` / `RESTRICT`. The controlled function MUST NOT touch it. |

`ON DELETE CASCADE` is forbidden for both classifications, and for every foreign
key referencing either table.

Every such migration MUST include a focused migration-level test asserting both
the **foreign key target** and the **delete action** (`confdeltype = 'a'` or
`'r'` in `pg_constraint`), mirroring the existing employee foreign-key delete-
action assertions. A new operational dependency that is not added to the
controlled function fails closed through the `foreign_key_violation` handler and
surfaces as `protected_dependency`; the migration test exists so that failure is
found in CI rather than in production.

---

## 12. Alternatives considered and rejected

| Alternative | Why rejected |
|---|---|
| Soft delete (`deleted_at` / `deleted_by_user_id`) on `vacation.leave_requests` | Does not satisfy the requirement. The operational row, its exclusion-constraint reservation, and its list/calendar presence would persist, and every existing query would need a filter. `PROJECT_INSTRUCTIONS.md` §9.6 allows soft delete where records must remain recoverable and referenced — here the explicit decision is that the document must physically cease to exist. |
| `ON DELETE CASCADE` from `leave_request_history` (and anything else) | Prohibited by `PROJECT_INSTRUCTIONS.md` §9.4 and `DATABASE.md` §9.3 for business history, and would make a future evidentiary table silently cascade-deletable by adding one careless migration. Explicit ordered statements in the controlled function keep the blast radius reviewable. |
| Granting the runtime role `DELETE` on `vacation.leave_requests` | Breaks the least-privilege pattern established by migrations 023–032 and would make every future SQL bug a potential data-loss event. The controlled `SECURITY DEFINER` function is the platform's settled answer. |
| Deleting or nulling ledger entries for the request, or posting a neutralizing entry as part of deletion | Violates ADR-0005 §12 and ADR-0006 append-only immutability, and would make balances non-replayable. Deletion is not a balance event. |
| Auto-cancelling an `APPROVED` request as part of deletion | Hides a consequential, separately permissioned, separately audited business decision inside a destructive administrative command, and would produce a compound audit story that is hard to defend. Two decisions stay two commands. |
| Reusing `vacation.requests.manage` / `vacation.leave-types.manage` for deletion | Conflates workflow administration with irreversible removal, and removes the ability to grant one without the other. |
| Keeping the public UUID only on `vacation.leave_requests` and letting it disappear with the document | Would leave retained audit events and ledger entries pointing at an identifier that resolves to nothing and could, in principle, be re-issued. The permanent identity table exists precisely to prevent that ambiguity. |
| Renumbering or re-sequencing request IDs during the identity backfill | Would break `ck_vacation_leave_balance_entries_cause_shape` (`source_reference = leave_request_id::text`) and posting idempotency. |
| `DELETE /api/v1/vacation/requests/{id}` with a required JSON body | See §8.1: undefined body semantics, idempotency mismatch, inconsistent tooling support, and a second conflicting `DELETE` convention in a repository where every other `DELETE` is bodyless. |
| Treating this as privacy erasure / anonymization | Different requirement, different legal basis, different authority. It would have to erase ledger and audit evidence, which this decision forbids. Requires its own ADR. |

---

## 13. Consequences

- Vacation gains one permanent identity table, one permanent marker table, one
  new column, two permissions, one new controlled function, and two
  forward-upgraded functions. No existing behavior changes until increment 3.
- `vacation.leave_requests.id` stops being self-generating. Every insert path
  must allocate the identity first. This is a real, if small, change to the
  request-creation repository code and its tests.
- Reporting and ledger-history reads must tolerate a missing operational
  request. Inner joins become a documented defect class.
- Leave-type deletion becomes strictly harder: permanent markers plus
  `is_system` mean a seeded or ever-used type is permanently undeletable. This
  is the intended trade.
- A deleted request is unrecoverable except through PITR. The Portal must state
  this before confirmation.
- Administrator tokens require refresh after the permission migration.
- Existing ADR-0005/ADR-0006 invariants are strengthened, not amended: no
  decision here changes ledger boundaries, entry kinds, quantities, or balance
  derivation.

## Security and operational impact

Deletion is a privileged, irreversible operation. It is protected by a dedicated
permission, executed only through an owner-owned `SECURITY DEFINER` function
with a locked-down `search_path`, guarded by row and advisory locks, restricted
to terminal and ledger-neutral documents, and atomically audited with actor,
reason, and the full deleted-document fact set. The runtime role gains no new
table `DELETE` privilege anywhere.

The main residual operational risk is unrecoverability. It is mitigated by
eligibility narrowness (only terminal, ledger-neutral documents), by the
mandatory reason, by permanent audit and ledger evidence, and by explicit
operator-facing wording that PITR is the only recovery path. Backup and restore
requirements are unchanged; verified backups remain a precondition for operating
this capability.

---

## 14. Implementation plan (bounded increments)

Increments are strictly ordered. Each ends at its stop condition; the next
starts as a new session per `AI_WORKING_AGREEMENT.md` §2–§3.

### Increment 1 — Permanent identity, ledger hardening, leave-type protection

**Scope.** Database foundation only. No API, Portal, permission, or behavior
change. After this increment the platform behaves exactly as before, but is
structurally ready for deletion.

**Migrations / files.**

- `database/migrations/036_vacation_leave_request_identities.sql` — identity
  table, immutability trigger, backfill, `setval`, drop `GENERATED ALWAYS` on
  `leave_requests.id`, composite FK, repoint
  `leave_balance_entries.leave_request_id` to the identity table, runtime grants
  (`SELECT` + table `INSERT` on identities, sequence `USAGE`,
  `INSERT (id, public_id)` on `leave_requests`).
- `database/migrations/037_vacation_ledger_request_existence_hardening.sql` —
  `CREATE OR REPLACE` of `vacation.enforce_leave_balance_entry_integrity()`.
- `database/migrations/038_vacation_leave_type_protected_dependencies.sql` —
  marker table, trigger function, three triggers, backfill, and
  `CREATE OR REPLACE` of `vacation.delete_unreferenced_leave_type(uuid)` to read
  markers.
- `database/migrations/039_vacation_system_leave_types.sql` — `is_system`
  column, seeded-code update, `is_system` check inside the leave-type delete
  function with the added `System leave type` label.
- `apps/api/.../LeaveRequestsRepository.cs` — identity-first insert (the one
  unavoidable code change in this increment).
- `apps/api/.../LeaveTypesRepository.cs` / `LeaveTypesModels.cs` — read-only
  `isSystem` projection.

**Invariants.** Every existing request `id` and `public_id` is preserved; no
ledger row is read as changed; no `ON DELETE CASCADE` anywhere; no runtime
`DELETE` grant; markers never removed; runtime cannot set `is_system`.

**Focused tests.** Backfill row-count and value equality (`leave_requests` vs
identities); identity sequence high-water mark; identity immutability trigger
rejects `UPDATE` and `DELETE`; `leave_balance_entries` FK target and
`confdeltype`; hardened trigger rejects an entry for a non-existent request;
hardened trigger still rejects the four pre-existing invariant violations;
leave-type marker backfill completeness; `is_system` true for exactly the five
seeded codes; runtime role has no `INSERT`/`UPDATE` privilege on `is_system`;
runtime role has no privilege on the marker table; employee-marker regression
(§5.3).

**Validation.** Migrator run against the configured development database with a
second pass showing no pending scripts; API Debug build; database-enabled
focused Vacation suite; full database-enabled API suite with the two documented
pre-existing failures identified explicitly; `git diff --check`.

**Recommended AI tool.** Codex (focused repository implementation, migrations,
database-enabled tests).

**Stop condition.** Migrations applied and journaled, focused tests pass, no API
or Portal contract change, `DATABASE.md` and `docs/domain/vacation.md` updated
for the implemented structures only.

### Increment 2 — Permissions and the controlled delete function

**Scope.** Permission seeding and the deletion function. Still no endpoint.

**Migrations.**

- `database/migrations/040_vacation_delete_permissions.sql` — seed
  `vacation.requests.delete` and `vacation.leave-types.delete`; assign both to
  `Administrator` idempotently (pattern of 031/035).
- `database/migrations/041_vacation_delete_neutralized_leave_request.sql` —
  `vacation.delete_neutralized_leave_request(uuid)`, owner, `REVOKE`/`GRANT`.

**Invariants.** Function owned by `internal_apps_owner`; `SECURITY DEFINER`;
`SET search_path = pg_catalog`; `EXECUTE` granted only to `internal_apps_app`;
no table `DELETE` grant; deletes limited to history then request; ledger,
balances, policies, audit, identities untouched; conflict tokens exactly the
three allow-listed values.

**Focused tests.** Live-database checks that the function is `SECURITY DEFINER`,
owned correctly, and `EXECUTE`-granted only to the runtime role; runtime role
still lacks direct `DELETE` on requests and history; unknown public ID returns
zero rows; `SUBMITTED` and `APPROVED` conflict with `non_terminal_status`;
`CANCELLED` with a balanced consumption/reversal pair succeeds and leaves both
ledger rows intact; a synthetic non-zero request-scoped sum conflicts with
`ledger_effect_not_zero`; history row count returned matches rows removed;
permission rows exist and are assigned only to `Administrator`. Each focused
database test creates its own fixtures, runs inside a transaction where the
repository conventions permit, and rolls back after validation. Tests leave no
request, history, or ledger fixture in the development database.

**Validation.** Migrator apply and second pass; focused database-enabled tests;
API build; `git diff --check`.

**Recommended AI tool.** Codex.

**Stop condition.** Both migrations applied, function behavior verified against
the live development database, `SECURITY.md` permission table updated, no
endpoint exposed.

### Increment 3 — API service, transaction, Problem Details, and audit

**Scope.** `POST /api/v1/vacation/requests/{requestId}/delete` and the
leave-type permission move.

**Files.** `LeaveRequestModels.cs` (`DeleteLeaveRequestRequest`),
`LeaveRequestService.cs` (validation, transaction, function call, audit,
conflict-token parsing against the fixed allow-list),
`LeaveRequestEndpoints.cs` (route, permission, OpenAPI, Problem Details),
`VacationPermissions.cs` (two constants), `VacationEndpoints.cs` /
`LeaveTypesService.cs` (leave-type delete permission move and
`leave_type_system_protected` mapping).

**Invariants.** One connection, one transaction, function call plus audit event,
commit; audit failure rolls back the deletion; reason trimmed and length-checked
server-side; only allow-listed tokens cross the boundary; no internal ID, SQL,
or exception text in any response; endpoint declares
`vacation.requests.delete`.

**Focused tests.** Endpoint/permission contract; `401`, `403`, `404`;
validation `400` with `errors.reason` for missing, blank, whitespace-only, and
501-character reasons; `409` for each conflict code; `204` on success; audit
event written with every §9 fact in the same transaction; audit-failure
rollback; unknown token maps to the generic conflict; OpenAPI generation.

**Validation.** API Debug build; focused Vacation API suite; full
database-enabled suite; OpenAPI generation check; `git diff --check`.

**Recommended AI tool.** Codex.

**Stop condition.** Endpoint implemented and tested, `API_GUIDELINES.md` updated,
Portal unchanged.

### Increment 4 — Portal deletion UX

**Scope.** Administrator request-details deletion control and leave-type
system/protected messaging.

**Files.** `apps/portal/src/app/vacation/admin/requests/[requestId]/…`,
`apps/portal/src/app/vacation/leave-types/page.tsx`, the shared typed API
client, and Serbian Latin / English locale resources.

**Invariants.** Control rendered only for terminal requests and only with
`vacation.requests.delete`; canonical `ConfirmDialog` with a required
1–500-character reason field and explicit irreversibility wording; success and
conflict feedback through the shared top-center `PortalNotificationHost`; no
`window.confirm`; no native date inputs; no feature-local button/input class
constants; localized copy for every Problem Details code including
`leave_type_system_protected`; after success, navigate back to the list and
refresh.

**Focused tests.** `PortalAdministrationUiContractTests` extensions for control
ownership, permission gating, terminal-only visibility, `ConfirmDialog` usage,
and notification host usage.

**Validation.** Portal strict TypeScript; Portal production build with both
routes included; focused Portal contract tests; `git diff --check`.

**Recommended AI tool.** Claude Code (broad frontend work across related
components and UI consistency review).

**Stop condition.** Static Portal validation passes; browser smoke deferred to
increment 5.

### Increment 5 — Controlled runtime validation and documentation completion

**Scope.** Controlled smoke and final documentation. No new behavior.

**Files.** `scripts/smoke/vacation-request-deletion.ps1` (or `.mjs` for the
browser leg), plus the documentation updates in §15.

**Invariants.** Smoke does not create a retained `CANCELLED` request with
permanent ledger entries merely to validate this capability. Any smoke fixture
must be removable without deleting ledger or audit evidence. Ledger-preservation
and balanced cancellation/reversal behavior are validated by the focused,
transaction-rolled-back database tests in increment 2.

**Validation.** Eligible `REJECTED` request deletion; `SUBMITTED` and `APPROVED`
refusals; repeated delete returning `404`; audit event present with every
required fact; system leave type delete refused; permission denial for a
non-Administrator identity where a fixture exists; Serbian Latin and English;
light and dark; desktop and mobile; clean console. The focused database suite,
not retained smoke data, validates cancel-then-delete, unchanged ledger evidence,
employee and leave-type permanent markers, and the removed-document ledger-history
state.

**Recommended AI tool.** Codex for the API/database legs; Claude Code for the
browser leg.

**Stop condition.** Smoke results recorded verbatim, including any scenario
skipped for a missing safe fixture; §15 documentation applied; capability
described as implemented only for what actually passed.

---

## 15. Proposed documentation updates

These are prepared, not applied. Each is applied with the increment that makes
it true. Until then, no canonical document may describe this capability as
implemented.

**`docs/architecture/DATABASE.md`** — in §7.2 add a subsection *7.2.6 Permanent
request identity and controlled request deletion* describing
`vacation.leave_request_identities` (permanent, never deleted, one-to-one with
the operational document through the composite key), the repointed
`leave_balance_entries` foreign key, `leave_request_history` as operational
child data deleted by explicit ordered statements, the hardened integrity
trigger, `vacation.leave_type_protected_dependencies`,
`vacation.leave_types.is_system`, and the §11 forward-compatibility
classification rule with its `ON DELETE CASCADE` prohibition and required
migration test. Extend the §20 checklist with "Every new table referencing a
Vacation request is classified as operational or evidentiary." (Increments 1–2.)

**`docs/architecture/SECURITY.md`** — add `vacation.requests.delete` and
`vacation.leave-types.delete` to the §3 permission table with "Seeded only to
the existing `Administrator` role by migration 040"; add the token-refresh
sentence for migration 040 to the existing list; amend the §3 paragraph
"Runtime grants do not permit physical deletion of Vacation requests, balances,
or history" to state that request deletion is available only through the
owner-controlled `vacation.delete_neutralized_leave_request(uuid)` function and
that the runtime role still holds no table `DELETE`. (Increments 2–3.)

**`docs/architecture/API_GUIDELINES.md`** — add
`POST /api/v1/vacation/requests/{requestId}/delete` to the Vacation Leave
Request endpoint table with permission `vacation.requests.delete` and its
behavior; record the six Problem Details codes; move
`DELETE /api/v1/vacation/leave-types/{publicId}` to `vacation.leave-types.delete`
and note `leave_type_system_protected`; add one sentence to §2 recording that a
destructive command requiring a body uses an explicit `POST` command route
rather than a body-bearing `DELETE`. (Increment 3.)

**`docs/domain/vacation.md`** — replace "There is no draft and no physical
deletion" in *Leave requests* with the deletion rule: terminal status plus
exactly-zero request-scoped ledger net effect, cancellation first when a
business effect is active, no cascade, no ledger mutation; add the permanent
identity and its backfill guarantee; add the ledger-trigger hardening under the
LV.2 boundary section; extend *Leave types* with permanent dependency markers
and `is_system`; add the reporting consequences from §10. (Increments 1–4.)

**`docs/modules/vacation.md`** — add a *Request deletion* section covering the
command, permission, eligibility, conflicts, audit facts, Portal UX, and the
PITR-only recovery statement; extend *Leave Type administration* with the marker
and system-type rules; document the non-retained controlled validation approach.
(Increments 3–5.)

**`docs/PLATFORM_STATE.md`** — under *Vacation module*, record controlled
administrative request deletion once increment 5 passes; under *Known
limitations*, record that Administrator tokens require refresh after migration
040 and that a deleted request is recoverable only through PITR; update
*Current validation* with the recorded results. (Increment 5.)

**`docs/CHANGELOG.md`** — one dated entry per increment, describing what was
added and validated, in the established style. The increment-1 entry explicitly
states that no deletion capability is exposed by it.

---

## 16. Approved decision confirmations

The architecture owner has explicitly approved the following decisions; they
are closed and require no further confirmation before bounded implementation:

1. The existing Leave Type physical-delete endpoint moves from
   `vacation.leave-types.manage` to `vacation.leave-types.delete`. This is an
   intentional authorization narrowing. The new permission is initially
   Administrator-only, and token refresh or re-login is required after migration
   040.
2. Exactly `ANNUAL_LEAVE`, `PAID_LEAVE`, `UNPAID_LEAVE`, `SICK_LEAVE`, and
   `OTHER` are canonical system Leave Types and receive `is_system = true`.
   They cannot be physically deleted, may be deactivated under existing rules,
   and cannot have `is_system` changed by the runtime application.
3. The mandatory deletion reason is retained permanently in central audit only.
   It is not duplicated in a Vacation business or operational table.
4. A deleted request disappears from employee and administration operational
   views without a tombstone. Its permanent identity, ledger evidence, and
   central audit evidence remain; audit is the retained administrative record.
   This is not privacy erasure.
5. `vacation.leave_requests.public_id` remains for the current implementation.
   Dropping it or deriving it from the identity table is deferred indefinitely;
   the composite identity relationship continues to prohibit divergence.
6. Focused database tests create their own fixtures, use transactions where
   repository conventions permit, and roll back after validation. No retained
   `CANCELLED` smoke request or permanent ledger fixture is approved merely to
   validate deletion. The capability is justified by rare correction of an
   erroneous operational document, not by smoke-data cleanup.
