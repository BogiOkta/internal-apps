# ADR-0005: Define LV.2 Leave Balance Ledger Boundaries

## Status

Accepted

## Date

2026-07-25

## LV.2 amendment

This amendment replaces every decision, business rule, consequence, and
unresolved-decision statement below. The retained text is historical context
only and is not normative.

LV.2 is a small Vacation-owned append-only balance history. A balance is
identified by an Organization employee, the existing Leave Type, and calendar
year. Only Leave Types with `counts_against_vacation_balance` participate. No
balance category, Leave Type mapping, or entitlement-period entity is used.

The required immutable entry kinds are annual entitlement, carry-over, manual
adjustment, approved-request consumption, and cancellation reversal. Every
entry retains its balance key, signed working-day quantity, effective date,
business cause, actor or system origin, and reason or note. Current balance is
the signed sum of those entries; employee balance history is their
chronological view. A derived cache is never authoritative.

Annual entitlement and carry-over are accepted credits. Manual adjustments are
reasoned, signed administrator actions and do not need dual control. Approval
of a balance-consuming request atomically checks that the resulting balance is
non-negative and posts its persisted working-day quantity exactly once.
Cancellation of an approved request atomically posts one equal-and-opposite
reversal linked to that consumption. Submission, rejection, and cancellation
before approval have no balance effect. Request transition, ledger posting,
and required Core Audit are atomic and idempotent.

Organization owns employees; Leave Policy owns entitlement inputs; Leave
Request owns workflow and persisted quantity; Business Calendar owns
working-day calculation; and Core Audit owns audit evidence. The Vacation
application layer coordinates the use cases. None replaces the ledger, and the
Portal does not calculate or mutate an authoritative balance.

### Explicitly deferred from LV.2

- generalized balance categories and multi-Leave-Type accounts;
- entitlement-period infrastructure and open/closed lifecycle;
- dual-control adjustment authorization, correction workflow, and
  segregation-of-duties roles;
- annual closing, automatic carry-over calculation, expiration, caps,
  priority, buckets, allocations, non-compounding, and closed-period rules;
- transaction headers, generic source polymorphism, double-entry accounting,
  reusable Core ledger abstractions, and speculative effect types; and
- projections, reconciliation tooling, physical design, SQL, migrations,
  APIs, application code, and legacy cutover.

### First vertical implementation slice

Record annual-entitlement and carry-over credits for an employee, existing
balance-consuming Leave Type, and calendar year; expose derived current balance
and chronological employee history; atomically post approved-request
consumption and its cancellation reversal; and append a reasoned manual
adjustment. This slice introduces none of the deferred structures.

## Context

Vacation currently has three related but distinct concepts:

- Leave Policy stores annual entitlement inputs for one employee and leave
  year;
- Leave Request stores workflow state and a Business Calendar-calculated
  working-day quantity;
- the existing yearly balance persistence stores entitlement components and a
  mutable used-day total for one employee, Leave Type, and year.

A future Leave Balance Ledger must establish one authoritative explanation of
every balance change without moving Vacation business rules into Organization,
Business Calendar, Core Audit, or the Portal. The current policy and balance
dimensions do not yet align, and their adjustment concepts overlap. Those
questions must be resolved before a ledger database design is approved.

## Decision

The Leave Balance Ledger is an internal Vacation capability, not a separate
module and not a shared Core service. Vacation owns entitlement interpretation,
balance-affecting business events, balance sufficiency, reversals, and balance
views.

Capability boundaries are:

- Organization owns employee and department master data. Vacation references
  an Organization employee but owns that employee's leave account and leave
  history.
- Leave Policy owns approved entitlement inputs and their administrative
  lifecycle. It does not own consumed, remaining, or calculated balance.
- Leave Request owns the request interval, persisted authoritative working-day
  quantity, and workflow state. Approval and approved cancellation are
  balance-affecting causes, but the request workflow does not independently
  maintain a balance.
- Business Calendar owns working-day calculation rules. It supplies the
  quantity persisted by Leave Request and does not post, reverse, or
  recalculate ledger effects.
- Leave Balance Ledger owns the immutable sequence of accepted
  balance-affecting entries, their reversals, balance calculation, and any
  derived balance view.
- Core Audit records who performed consequential operations and their business
  meaning. It does not replace the ledger or determine a balance.
- The Vacation application layer coordinates a request transition, ledger
  effect, and Core Audit event atomically where the use case requires all
  three.

The following core invariants apply:

1. Every accepted balance effect belongs to exactly one resolved Vacation
   leave account and identifies its employee, applicable leave period,
   balance category, signed quantity, business source, effective business date,
   actor or system origin, and reason. Credits increase and debits decrease the
   balance.
2. Accepted ledger entries are append-only. A correction or cancellation adds
   a traceable equal-and-opposite reversal and, when needed, a new corrected
   entry; it never edits or deletes the original financial effect.
3. A business cause has at most one effective posting. Retries must be
   idempotent, and a reversal must identify the posting it compensates.
4. The authoritative balance is the algebraic result of applicable ledger
   entries. A cached or projected entitlement, used, or remaining value is
   derived and must be reconcilable; it is not an independent source of truth.
5. Approving a balance-consuming request posts its persisted working-day
   quantity exactly once. Cancelling that approved request reverses exactly
   that effect. Submission, rejection, and cancellation before approval do not
   consume balance.
6. Approval, its ledger effect, and its audit event succeed or fail together.
   An approval must not make the effective balance negative. Concurrent
   approvals must enforce the same rule.
7. Later Business Calendar changes do not change the quantity of an existing
   request or any posting caused by it.
8. Historical entries remain attributable when an employee, Leave Type, or
   other referenced configuration becomes inactive. Inactivation does not
   erase or rewrite leave history.
9. Ledger history and request transition history have different purposes and
   neither substitutes for the other. Their shared business cause must remain
   correlatable.
10. All quantities within one leave account use one canonical unit and
    precision. The concrete unit and precision must be approved before database
    design.

The following responsibility overlaps are prohibited:

- Leave Policy must not store used, consumed, remaining, or independently
  calculated balance values.
- Leave Request must not become a second balance ledger or maintain an
  authoritative used/remaining aggregate.
- Business Calendar must not decide entitlement, sufficiency, posting, carry-
  over, or adjustment behavior.
- Organization must not own leave entitlement or leave transaction history.
- Core Audit must not be queried as the source of a leave balance.
- The Portal must not authoritatively calculate, post, reverse, or reconcile
  balances.
- Other modules and repositories must not write Vacation ledger state
  directly.
- A generic shared accounting or ledger abstraction must not be introduced
  without a second concrete, domain-neutral use case and a separate approved
  decision.

No ledger database shape is approved by this ADR.

## Finalized Business Rules

The **Vacation policy owner** is the business role accountable for company
leave policy. The **Vacation balance administrator** may perform ordinary
ledger administration through `vacation.leave-balances.manage`. A **Vacation
balance approver** independently authorizes manual adjustments through
`vacation.leave-balances.approve-adjustments`. A person must not approve their
own proposed adjustment. The system may perform only the deterministic
postings required by these rules; it has no discretion to invent policy.
Permission names define owner capabilities, not an API or persistence design.

### 1. Leave account dimensions

**Rule.** A leave account is uniquely defined in business terms by Organization
employee, Vacation balance category, and entitlement period. Each
balance-consuming Leave Type must map to exactly one balance category for the
whole period; multiple Leave Types may consume the same category.
Non-balance-consuming Leave Types map to no account. Department, manager,
employment status, and Leave Type are attribution or policy inputs, not
additional account dimensions. A mapping change applies only from the next
entitlement period; history retains the resolved account used at posting.

**Business rationale.** This aligns employee/year entitlement with several
request labels without fragmenting one benefit or making organizational
changes rewrite history.

**Owner capability.** The Vacation policy owner approves categories and
mappings; a Vacation balance administrator maintains the approved
configuration.

**Configuration.** The dimension model and prospective-only rule are fixed.
Categories and Leave Type mappings are configurable.

### 2. Supported balance types

**Rule.** The supported balance types are the following balance-effect types:
opening entitlement,
carry-over, consumption, expiration, manual adjustment, reversal, and closing
transfer. Credits and debits retain one of these types and their business
source. “Used” and “remaining” are derived views, not effect types or
independently editable balances. New effect types require an approved domain
documentation change.

**Business rationale.** A closed vocabulary makes every balance explainable
while preventing mutable totals from becoming competing sources of truth.

**Owner capability.** Vacation owns classification; only the originating
approved workflow, a Vacation balance administrator, or the deterministic
closing process may cause its applicable type.

**Configuration.** Fixed.

### 3. Quantity unit

**Rule.** The canonical unit is a working day with precision of one half-day
(0.5 day). A balance-affecting quantity must be a whole or half day; full-day
requests use the persisted Business Calendar working-day quantity and
half-day requests may cover exactly one working date. Hours and other
fractions are not supported. A future unit may be introduced only by an
approved versioned rule; units must never be mixed or converted implicitly
within an account.

**Business rationale.** Days preserve the current calendar and policy model,
while half-days cover the approved partial-day need without false hourly
precision.

**Owner capability.** Fixed by the Vacation policy owner and platform
architecture owner; Business Calendar determines whether a date is a working
date but does not choose the leave quantity.

**Configuration.** Fixed for the current ledger; future extensibility requires
a new approved rule, not tenant or administrator configuration.

### 4. Entitlement periods

**Rule.** An entitlement period is the calendar year from January 1 through
December 31 in the company business time zone. A request may consume only the
account for the period containing its leave dates and may not span periods.
Opening entitlement is effective on January 1. Backdated postings are allowed
only while that period is open and must use the facts and policy applicable to
their effective business date.

**Business rationale.** This matches current annual policy and request
boundaries and makes sufficiency and closing deterministic.

**Owner capability.** The Vacation policy owner sets annual entitlement; a
Vacation balance administrator may administer an open period.

**Configuration.** Calendar-year boundaries and single-period requests are
fixed. Entitlement quantities are configurable per employee, category, and
period.

### 5. Carry-over

**Rule.** At annual closing, an account may transfer unused, unexpired
current-period entitlement into the immediately following period. Carry-over
is never copied manually, never skips a period, and never compounds:
prior-period carry-over and positive manual adjustments do not themselves
carry forward. The transferable amount is the lesser of the eligible unused
entitlement and the configured cap. If carry-over is disabled, the amount is
zero.

**Business rationale.** This supports company benefit policy while preventing
duplicate, indefinite, or administrator-invented entitlement.

**Owner capability.** The Vacation policy owner approves enablement and caps;
the deterministic closing process calculates the transfer, and a Vacation
balance administrator may initiate closing.

**Configuration.** Eligibility, one-period reach, and non-compounding are
fixed. Enablement and a non-negative cap are configurable by balance category
and destination period.

### 6. Expiration

**Rule.** Carry-over must have an expiration date within its destination
period. Its unused remainder expires at the start of that business date and
cannot satisfy leave occurring on or after that date. Expiration creates an
explicit debit; it never mutates the carry-over credit. Current entitlement
and manual adjustments have no independent mid-period expiration; unused
current entitlement is cleared only by annual closing. An expiration date
already governing an accepted posting may not be changed retroactively.

**Business rationale.** Explicit expiration preserves a reconstructable
history and prevents retroactive loss of leave already validly consumed.

**Owner capability.** The Vacation policy owner sets the expiration policy;
the deterministic ledger process posts expiration.

**Configuration.** The expiration behavior is fixed. The date is configurable
by balance category and destination period before the carry-over is posted.

### 7. Consumption priority

**Rule.** A debit consumes valid carry-over first, ordered by earliest
expiration, and then current-period entitlement. Manual adjustments change the
account's total availability but do not form a selectable consumption bucket.
Users and administrators cannot override allocation for an individual
request. A reversal restores the exact allocations of the debit it reverses.

**Business rationale.** Earliest-expiring benefit first minimizes accidental
forfeiture, provides deterministic replay, and makes cancellation exact.

**Owner capability.** The ledger applies priority automatically; no owner has
discretion per transaction.

**Configuration.** Fixed.

### 8. Negative balance policy

**Rule.** The effective account balance must never be negative. Request
approval, manual adjustment, expiration, correction, reversal, and closing
must each enforce the rule atomically under concurrency. No overdraft,
grace amount, or role override is permitted. A rejected operation has no
ledger or successful audit effect.

**Business rationale.** Entitlement is a hard authorization limit and must not
depend on timing or administrative privilege.

**Owner capability.** Enforced by the Vacation ledger; Vacation balance
administrators may add entitlement only through an approved positive
adjustment, not bypass sufficiency.

**Configuration.** Fixed.

### 9. Manual adjustments

**Rule.** A manual adjustment is exceptional, signed, and limited to whole or
half days. It requires an affected account, effective date in an open period,
an approved reason code, a factual explanation, proposer, and independent
approver. Allowed reasons are statutory entitlement, employment-data
correction, historical/migrated-balance correction, and exceptional company
award.
Routine entitlement, carry-over, consumption, cancellation, or expiration
must use their own effect type. An accepted adjustment is immutable, cannot
make the balance negative, and cannot itself carry over or expire.

**Business rationale.** Dual control and narrow reasons allow necessary human
correction without turning adjustment into an unaudited policy bypass.

**Owner capability.** A Vacation balance administrator with
`vacation.leave-balances.manage` proposes; a different authorized person with
`vacation.leave-balances.approve-adjustments` approves or rejects. Core Audit
records both consequential actions.

**Configuration.** Quantity, approved reason, explanation, and effective date
are transaction inputs. The reason set, dual control, open-period rule, and
non-negative limit are fixed.

### 10. Correction versus reversal

**Rule.** Reversal is the equal-and-opposite compensation of one accepted
effect and must reference it. It is used when that effect must cease to count,
including approved request cancellation. Correction is a reversal followed
by a new correct effect when the business event remains valid but its account,
quantity, date, classification, or reason was wrong. Partial reversal is not
allowed; a partial change reverses the whole effect and posts the corrected
effect. Neither operation edits or deletes history, and reversing a reversal
is prohibited; restoration requires a new, explicitly justified effect.
Ordinary reversal and correction apply only while the affected period is open;
a later-discovered closed-period error follows the annual-closing rule.

**Business rationale.** Distinguishing cancellation from replacement keeps
causal history unambiguous and replay deterministic.

**Owner capability.** The originating workflow performs prescribed
cancellation reversals. Other corrections require the same proposal,
independent approval, and audit capabilities as manual adjustments.

**Configuration.** Fixed.

### 11. Annual closing

**Rule.** A period may close only after December 31 when it has no submitted
requests with dates in that period, all scheduled expirations are posted, and
ledger reconciliation succeeds. Closing posts a closing-transfer debit for
eligible value and a matching carry-over credit into the next period, then
expires all other positive remainder; these effects and the close succeed or
fail together. Closing is idempotent and final: ordinary
backdated posting, reversal, correction, and policy changes are then
prohibited. A factual error found later is represented by an approved manual
adjustment in the current open period with the historical/migrated-balance
correction reason and explicit reference to the closed period; the closed
period is not reopened or rewritten.

**Business rationale.** Closing creates a stable annual boundary without
destroying the ability to correct later-discovered facts.

**Owner capability.** A Vacation balance administrator initiates closing; the
ledger verifies prerequisites and performs it deterministically. The Vacation
policy owner resolves policy exceptions before closing.

**Configuration.** Prerequisites, atomicity, finality, and correction route are
fixed. Carry-over settings used by closing are the approved configurable
policy.

### 12. Historical consistency

**Rule.** Accepted effects are append-only and retain the resolved employee,
account category, period, quantity, unit, allocation, effective date, source,
reason, actor or system origin, approval, and correlation facts that applied
when accepted. Later changes to employee data, Leave Types, mappings, policy,
Business Calendar, permissions, names, or status do not recalculate,
reclassify, orphan, or erase history. Authoritative balances must replay
deterministically from accepted effects; derived views must reconcile to that
history. Each business cause has at most one effective posting, and related
request history and Core Audit remain distinct but correlatable.

**Business rationale.** Stable facts support employee explanation, audit,
dispute handling, reconciliation, and safe retries over time.

**Owner capability.** Vacation owns reconstruction and reconciliation;
Vacation balance administrators may investigate but cannot rewrite history.
Only separately authorized retention or lawful anonymization processes may
alter identifying data, without changing financial meaning.

**Configuration.** Fixed.

## Remaining Decisions Outside These Business Rules

ADR-0006 resolves the logical persistence entities, stable public identifiers,
entry and allocation ordering, source correlation, reversal relationships,
and annual-closing records. The following implementation and rollout decisions
remain open and must be approved before implementation, but they do not change
the business rules above:

- the concrete initial balance categories, Leave Type mappings, entitlement
  quantities, carry-over caps, and expiration dates approved by the Vacation
  policy owner;
- projection freshness, reconciliation operations, and concurrency mechanisms;
- migration, backfill, reconciliation, and cutover of existing policies,
  mutable yearly balances, and request history; and
- dedicated role assignments and segregation-of-duties operations for the two
  approved owner capabilities.

No physical table design, SQL, API contract, or application design is approved
here.

## Alternatives

- Keep only the mutable yearly balance. Rejected because it cannot provide an
  authoritative, reconstructable explanation of corrections and historical
  balance changes.
- Treat Leave Policy or Leave Request as the ledger. Rejected because each owns
  a different business concept and would mix workflow or entitlement input
  with balance accounting.
- Put a generic ledger in Core. Rejected because leave entitlement and
  consumption rules are Vacation business logic and no second stable shared
  use case exists.

## Consequences

- Future ledger work stays within the Vacation module and preserves existing
  cross-capability dependency direction.
- Balance-changing request workflows require atomic ledger coordination and
  idempotency.
- Current balance persistence remains the implemented baseline until a
  separately approved migration and cutover design exists.
- Database and application implementation must stop at the unresolved
  decisions above rather than infer answers from the current schema.

## Security and Operational Impact

Ledger mutation requires dedicated Vacation authorization and atomic Core
Audit. Append-only history improves investigation and reconciliation, while
actor identity, reasons, and any sensitive notes remain subject to least-
privilege access and retention rules. Operations must expose reconciliation
failures and duplicate/rejected posting attempts without leaking sensitive
employee information.

## Owners

- Vacation module owner
- Platform architecture owner
