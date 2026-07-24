# Identity Domain

Identity owns login accounts, credentials, roles, permissions, and sessions.
An Identity user is not an Organization employee. Accounts and employee links
are created as separate explicit operations.

Minimal administration supports listing, creating, activating, and
deactivating users at `/api/v1/identity/users` and `/identity/users`. It
requires `identity.users.manage`. Usernames are immutable, users are never
physically deleted, and new accounts receive only the stable base `User` role.
That role initially has no management permissions; future Vacation own-request
permissions may be assigned to it in the sprint that implements that workflow.

The API hashes initial passwords with the existing login-compatible BCrypt
configuration before persistence. Passwords and hashes are never returned or
audited. No default password, reset workflow, invitation, role picker, or
employee auto-linking is provided. The Administrator transfers the initial
credential through an approved out-of-band channel.

Creation, activation, and deactivation are audited in the same transaction as
the Identity write. Repeating the current active-state command performs no
write and creates no audit event. Deactivation prevents login but retains
roles, explicit employee links, employee data, and history. An authenticated
administrator cannot deactivate their own account through the management API.

Migration 010 seeds the base role and management permission. Existing
Administrator access tokens require refresh or reissue after it is applied.
Migration 011 removes direct runtime access to role-assignment rows and exposes
only the fixed base-`User` assignment operation used during account creation.

The repeatable local validation script is
`scripts/smoke/sprint-04b-04c.ps1`. It consumes only environment-provided smoke
credentials documented as placeholders in `.env.example`, never prints
secrets, and must run only after migrations 009 and 010 pass review and are
applied.
