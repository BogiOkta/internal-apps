# ADR-0004: Use One Portal for User and Admin Features

## Status

Accepted

## Date

2026-07-09

## Context

The platform will contain many business modules and shared administrative capabilities. Separate user and administrator applications would duplicate the application shell, authentication/session handling, design system, navigation, deployment, and maintenance.

## Decision

Use one Next.js Portal for all user, module, and administrative features.

Modules contribute routes and permission-aware navigation to the shared Portal shell. Administrative pages appear in the same Portal only when the user has the required permissions. The API remains the authoritative authorization boundary.

## Consequences

- There is one frontend deployment, session model, design system, and navigation structure.
- User and administrator experiences share layouts and reusable components.
- Frontend permission checks control presentation only; direct API requests are always authorized server-side.
- Modules must not create separate frontend applications or parallel admin shells.
- Any future separate client consumes the same documented API and requires its own ADR.
