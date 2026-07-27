# ADR-0006: Define LV.2 Leave Balance Ledger Logical Model

## Status

Accepted

## Date

2026-07-25

## LV.2 amendment

This amendment replaces every logical-model, relationship, integrity,
alternative, and consequence statement below. The retained text is historical
context only and is not normative.

LV.2 has two Vacation-owned logical concepts:

| Concept | Responsibility | Business key |
|---|---|---|
| Leave balance | The scope for sufficiency and derived reads; it has no authoritative mutable total. | Employee + existing Leave Type + calendar year |
| Leave balance entry | One immutable signed balance effect. | Idempotent business cause, or immutable identity for a manual adjustment |

Each entry has a stable public identifier and records the balance key, signed
working-day quantity, effective date, acceptance time, one of the five LV.2
kinds, source correlation, actor or system origin, reason, optional
explanation, and, for a cancellation reversal, the consumed entry it reverses.
The five kinds are `annual_entitlement`, `carry_over`, `manual_adjustment`,
`request_consumption`, and `cancellation_reversal`.

One approved request produces at most one consumption. One approved
cancellation produces at most one reversal, in the same balance scope and with
the exact opposite quantity. One business cause produces at most one posting.
Entries cannot be updated or deleted; inactive employees and Leave Types stay
attributable. Current balance is the signed sum and history is the
chronological entries for the balance key. A consumption or manual debit is
accepted only when the result is non-negative.

LV.2 deliberately omits categories, mappings, entitlement periods,
transaction headers, adjustment authorizations, buckets, allocations,
corrections, annual closings, expiration, generic source infrastructure,
double-entry accounting, generic extensibility, and all physical design, SQL,
migration, API, application-code, projection, reconciliation, and cutover
decisions.

The first vertical slice establishes annual-entitlement and carry-over entries,
derives and displays the current balance and employee history, posts approved
request consumption and cancellation reversal, and accepts reasoned manual
adjustments. It uses the existing Leave Type and calendar-year concepts only.

## Context

ADR-0005 fixes the Leave Balance Ledger boundaries and business rules but
deliberately leaves its database shape open. The rules require an append-only,
replayable balance; employee/category/year accounts; deterministic carry-over
consumption; exact reversal; idempotent source posting; dual-controlled
adjustments and corrections; and final, atomic annual closing.

This decision defines logical entities, relationships, identifiers, and
integrity rules only. It does not define physical types, SQL, migrations,
indexes, API contracts, application services, projections, or legacy cutover.

## Decision

All ledger entities are owned by the `vacation` schema. Internal primary keys
remain repository details. Required public identifiers are opaque UUIDs.

### Entities, responsibilities, and keys

| Logical entity | Responsibility | Business key | Public ID |
|---|---|---|---|
| Balance category | Stable classification shared by balance-consuming Leave Types. | Case-insensitive stable code. | Required. |
| Entitlement period | Calendar-year boundary and open/closed state, with retained start/end dates. | Calendar year. | Required. |
| Leave Type balance mapping | Resolves one consuming Leave Type to one category for one whole period. | Leave Type + period. | No. |
| Leave balance account | Ledger aggregate for one employee, category, and period; owns sufficiency but no authoritative totals. | Employee + category + period. | Required. |
| Adjustment authorization | Proposal and independent decision for a manual adjustment or correction. | Its public ID is the business cause. | Required. |
| Ledger transaction | Immutable header grouping all entries accepted atomically for one business action. | Source kind + source ID + source event key. | Required. |
| Ledger entry | Immutable signed effect against exactly one account. Entries are summed for authoritative balance. | Transaction + ordinal. | No. |
| Balance bucket | Credit lot created only by opening entitlement or carry-over; retains expiry and lineage facts. | Origin credit entry. | No. |
| Entry allocation | Immutable allocation of part of one debit to one bucket. | Debit entry + bucket. | No. |
| Entry reversal | Equal-and-opposite relationship from a reversal entry to its original entry. | Original entry. | No. |
| Correction replacement | Relates a corrected replacement to the original reversed in the same correction transaction. | Original entry. | No. |
| Annual closing | Immutable successful close, reconciliation evidence, policy correlation, and its single atomic closing transaction. | Entitlement period. | Required. |

An adjustment authorization is the only mutable workflow record in this
model. Before decision it may be pending; it changes exactly once to approved
or rejected. It retains proposed account, signed quantity, effective date,
fixed reason, factual explanation, proposer, decision actor, decision time,
and whether it is an adjustment or correction. A correction additionally
identifies its original entries and proposed replacements. The approver must
differ from the proposer. Once decided, the record is immutable. Exactly one
ledger transaction may result from approval; rejection produces none.

### Relationships and cardinalities

- One category has zero or many mappings and accounts; each mapping and
  account has exactly one category.
- One period has zero or many mappings and accounts and zero or one annual
  closing; each such record has exactly one period.
- One Organization employee has zero or many accounts; each account has
  exactly one employee. Employee lifecycle changes do not cascade to history.
- A Leave Type has no mapping in a period when it does not consume balance and
  exactly one when it does. A category may serve many Leave Types.
- One transaction has one or many entries. Each entry has exactly one
  transaction and account. One account has zero or many entries and buckets.
- An opening-entitlement or carry-over credit creates exactly one bucket.
  Other entries create none. The bucket belongs to the credit's account.
- One debit has zero or many allocations and one bucket has zero or many
  allocations. Each allocation has exactly one debit and bucket.
- A reversal entry references exactly one non-reversal original. An original
  is reversed at most once. Reversal entries cannot be reversal targets.
- A corrected replacement references one original and is paired with that
  original's reversal in the same correction transaction. An original has at
  most one replacement.
- An approved authorization has exactly one transaction; pending and rejected
  authorizations have none. A transaction has at most one authorization.
- One annual closing has exactly one closing transaction and one period. A
  closing transaction belongs to exactly one annual closing.

### Immutable transaction and entry structure

A transaction is accepted only as a complete unit and is never updated or
deleted. Its fixed kinds are ordinary posting, reversal, correction, and
annual closing. It records its public identity, kind, effective business date,
acceptance instant, exactly one actor origin or fixed system-origin code,
reason and required explanation, one typed source correlation, and entries
ordered by a unique ordinal.

The typed source identifies exactly one supported cause:

- Leave Request plus approval or approved-cancellation event key;
- Leave Policy plus opening-entitlement event key;
- Adjustment Authorization;
- Balance Bucket plus expiration event key; or
- Annual Closing.

Exactly the applicable relationship is present. Known Vacation sources use
referential relationships, not an unenforced polymorphic identifier. The
source kind, source identifier, and event key are unique, making retries
idempotent. Request history and Core Audit remain separate but retain the
transaction public ID or the same source-correlation facts.

Every entry records a signed working-day quantity in 0.5-day increments and
one fixed effect type: opening entitlement, carry-over, consumption,
expiration, manual adjustment, reversal, or closing transfer. Zero is
prohibited. Opening entitlement and carry-over are credits; consumption,
expiration, and source closing transfer are debits; manual adjustment and
reversal may have either sign as constrained by their cause. A reversal is the
exact opposite of its original. Accepted entries cannot change account, type,
quantity, order, source, reason, allocation, or relationships.

Transactions preserve business causality, not double-entry accounting. They
need not sum to zero: entitlement, consumption, expiration, and adjustment are
legitimate one-sided changes. A closing transaction contains matched source
closing-transfer debit and destination carry-over credit plus explicit
expiration debits for all other positive remainder. All entries and the close
succeed or fail together.

### Account dimensions and allocation buckets

Employee, balance category, and entitlement period are the only dimensions.
Leave Type, department, manager, employment status, policy, actor, and source
are attribution or correlation facts. One account exists at most once for a
dimension combination and stores no authoritative entitlement, used, or
remaining total.

Buckets exist only for opening entitlement and carry-over. The rules need
these lots to distinguish carry-over expiry and priority and to calculate
carry-forward-eligible current entitlement without compounding earlier
carry-over or positive adjustments. A carry-over bucket has an expiration date
inside its destination period and retains its source-period opening-
entitlement lineage. An opening bucket has no mid-period expiration. Manual
adjustments never create buckets.

Every debit allocates first to unexpired carry-over buckets ordered by
expiration date and then stable bucket identity, and next to the opening
bucket. Any remainder is supported by unbucketed positive adjustment
availability. Debit allocation cannot exceed the debit; bucket allocation
cannot exceed remaining bucket quantity; unallocated debit cannot exceed
unbucketed availability. Expiration allocates only its own carry-over bucket.
Closing transfer allocates only eligible unused opening entitlement. Closing
expiration entries clear all other positive bucketed and unbucketed remainder.

A reversal relationship negates the original entry and all of that entry's
allocations for availability calculation. It does not delete allocations or
choose a new order, thereby restoring the original bucket state exactly.

### Annual closing

At most one annual closing exists per period. It is created only after all
documented prerequisites pass. It references the carry-over settings used,
records successful reconciliation facts, and owns one transaction containing
all account effects. Destination accounts belong to the immediately following
period. Every carry-over credit equals its source closing-transfer debit and
retains opening-entitlement lineage. Closing is atomic, idempotent, and
immutable. The period becomes closed in the same transaction; a closed period
accepts no ordinary posting, reversal, correction, mapping, or policy change.

### Required uniqueness and integrity constraints

The logical model requires:

- unique case-insensitive category code and unique category public ID;
- unique period year, unique non-overlapping calendar-year date range, and
  unique period public ID;
- unique Leave Type + period mapping;
- unique employee + category + period account and account public ID;
- unique authorization public ID, immutable terminal decision,
  proposer/approver inequality, approved-only transaction link, and at most
  one resulting transaction;
- unique transaction public ID and unique typed source business key;
- at least one entry per transaction, unique transaction + ordinal, non-zero
  half-day quantity, and sign/effect compatibility;
- effect/source compatibility, an effective date applicable to the account
  period for each ordinary effect, and a non-negative algebraic account
  balance after every atomically accepted transaction;
- unique bucket origin, compatible effect, same account, valid carry-over
  expiry, and immediately-prior-period lineage;
- unique debit + bucket allocation, positive half-day quantity, same account,
  and allocation totals within debit and bucket capacity;
- unique original across reversals, exact opposite account/quantity,
  non-reversal target, compatible reversal cause, and exact restoration of the
  original allocations;
- unique original across correction replacements, with full reversal and
  replacement in one correction transaction;
- unique annual-closing public ID, unique closing per period, unique closing
  transaction,
  immediately-following destination, matched transfer values, explicit expiry
  of all other remainder, and atomic period closure; and
- no update or delete lifecycle for accepted transactions, entries, buckets,
  allocations, reversals, correction replacements, or closings.

Ledger-history foreign keys use restrict/no-action deletion. Categories and
Leave Types deactivate rather than disappear. Separately authorized retention
or anonymization may change identifying presentation but not quantities,
causality, or account meaning.

## Decisions Deliberately Left Open

- Concrete initial categories, mappings, entitlements, carry-over caps, and
  expiration dates.
- Physical data types, constraint implementations, indexes, partitioning, and
  concurrency/locking mechanisms.
- Projection and reconciliation-tool names and freshness behavior.
- SQL, migrations, application services, API contracts, and Portal behavior.
- Migration, backfill, reconciliation, and cutover from existing policies,
  mutable balances, and request history.
- Dedicated role assignments and segregation-of-duties operations.

## Alternatives

- Signed entries without buckets or allocations were rejected because expiry,
  priority, non-compounding, eligible closing value, and exact reversal would
  not be reconstructable without reinterpreting history.
- Leave Type as an account dimension was rejected because ADR-0005 fixes
  category as the dimension and allows multiple Leave Types per category.
- Mutable used and remaining totals were rejected because entries are the
  authority and projections must reconcile.
- An unconstrained generic source identifier was rejected because known
  Vacation causes can retain referential integrity.
- Reopening closed periods was rejected because ADR-0005 requires a
  current-period historical-correction adjustment.

## Consequences

- Authoritative balances replay from immutable entries and allocations.
- Carry-over expiry, priority, non-compounding, closing eligibility, and exact
  reversal remain historical facts.
- Typed sources and uniqueness make posting retries idempotent.
- Existing `leave_balances` and `leave_policies` remain unchanged until a
  separate cutover design is approved.
- Physical implementation must enforce these invariants atomically but is not
  selected here.

## Security and Operational Impact

Ledger history and adjustment explanations require least-privilege Vacation
authorization. Core Audit remains mandatory but is not a balance source.
Retention, anonymization, backup, and restore must preserve financial meaning
and cross-record integrity.

## Owners

- Vacation module owner
- Platform architecture owner
