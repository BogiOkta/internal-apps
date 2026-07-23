# ADR-0001: Use PostgreSQL as the Platform Database

## Status

Accepted

## Date

2026-07-09

## Context

The platform needs one transactional database for shared Core services and independently owned business-module data. The database must support relational integrity, transactions, explicit schemas, reliable backup and restore, and access through Dapper from the ASP.NET Core API.

## Decision

Use PostgreSQL as the platform’s only transactional database.

Core capabilities and business modules share one database while owning separate schemas as defined in [`../architecture/DATABASE.md`](../architecture/DATABASE.md). The API and approved migration/operational identities are the only database access paths. PostgreSQL may run on an existing internal server; Docker Compose provides an optional local-development instance.

## Consequences

- Database design, migrations, tests, and operations target PostgreSQL behavior.
- Modules isolate data through schema ownership rather than separate databases.
- Users and the Portal never connect directly to PostgreSQL.
- Backup and restore cover the database as one consistent system of record.
- Introducing another transactional database requires a superseding ADR.
