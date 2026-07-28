# Business Calendar Domain

## Purpose and scope

Business Calendar is a shared platform capability for determining official
working and non-working dates in the Republic of Serbia.

Its scope is intentionally fixed:

- Saturday and Sunday are inherently non-working;
- official non-working dates are entered explicitly by an administrator;
- there is one tenant and one Serbian calendar;
- there is no working-Saturday support;
- there is no collective-vacation support;
- there are no regional calendars, recurrence rules, country records, calendar
  abstractions, background jobs, or caches.

## Data

`core.non_working_days` stores one explicit date, required name, optional
description, public identifier, timestamps, and creating/updating Identity
users. Date uniqueness is enforced by PostgreSQL.

## Service semantics

`IsWorkingDay(date)` returns false for Saturday, Sunday, or a date present in
`core.non_working_days`; every other date returns true.

`WorkingDaysBetween(from, to)` counts working dates inclusively: both `from`
and `to` participate in the count. A single-day range therefore returns either
zero or one. A range with `from > to` is invalid. A configured non-working date
that falls on a weekend remains one non-working date and is not double-counted.

Vacation delegates every working-day calculation to Business Calendar.
Request creation calls `WorkingDaysBetween` and persists its inclusive result;
approval and approved-request cancellation use that persisted result for
balance deduction and restoration. The request-creation preview reuses the
authenticated range endpoint. Vacation contains no weekend, holiday, or
working-day counting implementation of its own.

## Access

Authenticated users may call the calculation endpoints. Administrator CRUD
uses `identity.users.manage`; Vacation request administration separately uses
`vacation.requests.manage`. All successful creates, updates, and deletes write
platform audit events atomically.

## Portal administration

Authorized administrators manage explicit dates at
`/business-calendar/admin/non-working-days`. The localized Portal screen lists
dates in ascending order, defaults to the current year, provides a simple year
filter, and supports create, edit, and confirmed delete operations for date,
name, and optional description. Successful writes refresh the selected year's
list; validation, duplicate-date conflicts, loading, empty, forbidden, and safe
error states are presented without exposing backend exceptions.

The Portal intentionally provides no month calendar, recurrence, drag and
drop, working-Saturday overrides, collective vacations, country or regional
selection, import/export, bulk entry, or dashboard widget.

Controlled smoke validated authorized and unauthorized navigation, localized
direct-access denial, current-year and year-change loading, empty and required
states, refreshed edit and confirmed delete, API authorization, refresh
behavior, safe errors, and a clean console. It also corrected the persistence
timestamp materialization used by administrator list and write responses while
preserving the existing public API contract.
