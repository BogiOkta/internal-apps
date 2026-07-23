# ADR-0002: Use DbUp as the Migration Runner

## Status

Accepted

## Date

2026-07-09

## Context

Database changes must be ordered, repeatable, reviewable, and applied only by the database owner/migration identity. The API runtime identity must not own schemas or apply migrations.

## Decision

Use DbUp through the .NET 8 console application in `tools/migrator`.

The runner loads owner connection settings from the repository-root `.env` or existing process environment, reads ordered SQL files from `database/migrations`, records applied scripts in the DbUp journal, logs migration progress without credentials, and exits with failure when a migration fails.

## Consequences

- All schema changes are committed as immutable, ordered SQL migrations.
- Migrations run separately from API startup.
- `internal_apps_owner` applies migrations; `internal_apps_app` is reserved for least-privileged API runtime access.
- Required database roles or administrative prerequisites are completed before DbUp runs.
- Applied migration files are never edited; corrections use a new migration.
