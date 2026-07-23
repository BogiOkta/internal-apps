# ADR-0003: Use a Simple Custom Identity Model

## Status

Accepted

## Date

2026-07-09

## Context

The platform needs shared internal authentication and authorization with users, companies, roles, permissions, role assignments, refresh tokens, and login history. These concepts are already defined as platform-owned entities in the `identity` schema.

ASP.NET Identity includes a broader framework model and persistence conventions than the platform currently requires.

## Decision

Use a simple custom identity model instead of ASP.NET Identity.

The model uses the documented `identity` schema, JWT access tokens, rotated refresh tokens, password hashing through an approved .NET password hasher, roles as permission bundles, and server-side permission/resource authorization. Authentication remains a shared Core capability and is not implemented independently by modules.

## Consequences

- Identity tables and contracts remain explicit and aligned with platform terminology.
- The team owns account lifecycle, password, token, lockout, and authorization behavior.
- Security-sensitive behavior requires dedicated tests and review.
- Modules consume shared actor and authorization contracts; they do not parse tokens or store credentials.
- Adopting ASP.NET Identity later requires a superseding ADR and migration plan.
