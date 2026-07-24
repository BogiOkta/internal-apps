# Internal Apps Platform

Minimal runnable foundation for the company’s internal business-process platform.

## Project state and AI-assisted workflow

Start repository work with the concise [current platform state](docs/PLATFORM_STATE.md)
and follow the binding [AI-assisted development working agreement](docs/AI_WORKING_AGREEMENT.md).
Detailed architecture and delivery rules remain in
[project instructions](docs/PROJECT_INSTRUCTIONS.md).

## Status

Phase 0 - Foundation

The foundation contains:

- optional local PostgreSQL in Docker Compose;
- an ASP.NET Core .NET 8 API;
- a Next.js TypeScript Portal with Tailwind CSS;
- an authentication MVP with JWT access tokens and refresh-token rotation;
- an assigned-application launcher with the Vacation placeholder.

Vacation requests, balances, and other business modules are not implemented yet.

## Prerequisites

- Docker Desktop with Docker Compose
- .NET 8 SDK or a newer SDK capable of targeting .NET 8
- Node.js and npm

Docker is required only for Mode B. Mode A requires network access to the approved internal PostgreSQL server and the PostgreSQL `psql` client for the validation commands.

## First-time setup

From the repository root in PowerShell:

```powershell
Copy-Item .env.example .env
```

Do not commit `.env`. Replace placeholders only in the local file or through the approved environment/secret configuration. Never place a real server address or credential in `.env.example`.

## PostgreSQL hosting modes

Choose one database mode. The API does not connect to either mode yet.

### Mode A: Existing internal PostgreSQL server

Use this mode when PostgreSQL is already hosted on an approved internal server. Configure these values outside source control:

| Variable | Purpose |
|---|---|
| `DB_HOST` | Approved internal PostgreSQL hostname or IP address |
| `DB_PORT` | PostgreSQL port; default `5432` |
| `DB_NAME` | Platform database; `internal_apps` |
| `DB_OWNER_USER` | Ownership and future approved migration role; `internal_apps_owner` |
| `DB_OWNER_PASSWORD` | Owner password from the approved secret source |
| `DB_SSL_MODE` | Npgsql SSL mode required by the internal server |
| `DB_TRUST_SERVER_CERTIFICATE` | Whether Npgsql should trust the presented server certificate |
| `APP_DB_USER` | Future API runtime role; `internal_apps_app` |
| `APP_DB_PASSWORD` | Future runtime password from the approved secret source |

`internal_apps_owner` is for database ownership and future migrations only. The API must never use owner credentials. The future API runtime identity is `internal_apps_app` and will receive least-privileged access when database implementation is approved.

This bootstrap does not create the database, roles, application user, schemas, tables, or migrations on an existing server. An authorized database administrator must provision any required database and owner outside this task.

Validate network reachability and an already provisioned database from PowerShell after loading the real values into the current process environment:

```powershell
Test-NetConnection -ComputerName $env:DB_HOST -Port $env:DB_PORT
$env:PGPASSWORD = $env:DB_OWNER_PASSWORD
psql --host $env:DB_HOST --port $env:DB_PORT --username $env:DB_OWNER_USER --dbname $env:DB_NAME -c "SELECT current_database(), current_user;"
Remove-Item Env:PGPASSWORD
```

Expected query values are `internal_apps` and `internal_apps_owner`. These commands validate only; they do not create or modify database objects.

### Mode B: Optional local Docker PostgreSQL

Use Docker Compose only when a developer needs an isolated local PostgreSQL instance. The Compose file contains no API, Portal, migrations, initialization scripts, schemas, tables, or application-user creation.

Set a private local `POSTGRES_PASSWORD` in `.env`. The `POSTGRES_*` variables are used only by the local Docker container:

| Variable | Local Docker value |
|---|---|
| `POSTGRES_DB` | `internal_apps` |
| `POSTGRES_USER` | `internal_apps_owner` |
| `POSTGRES_PASSWORD` | Private local owner password |

Start and validate local PostgreSQL from the repository root:

```powershell
docker compose config
docker compose up -d postgres
docker compose ps
docker compose exec postgres pg_isready -U internal_apps_owner -d internal_apps
docker compose exec postgres psql -U internal_apps_owner -d internal_apps -c "SELECT current_database(), current_user;"
```

Expected query values are `internal_apps` and `internal_apps_owner`.

> PostgreSQL initialization variables apply only when the data volume is empty. If an earlier disposable bootstrap volume was initialized with another owner, stop Compose and remove that local volume before starting again. `docker compose down --volumes` permanently deletes that local database volume; use it only when no data must be preserved.

Stop local PostgreSQL without deleting its persistent volume:

```powershell
docker compose stop postgres
```

## Run migrations

The .NET 8 DbUp runner in `tools/migrator` reads ordered `.sql` files from `database/migrations`. Run it from the repository root.

Before the first migration, a PostgreSQL administrator must create the runtime login. `internal_apps_owner` intentionally does not have `CREATEROLE`.

The administrator must create `internal_apps_app` with the private `APP_DB_PASSWORD` value from the approved secret source and without elevated privileges:

```sql
CREATE ROLE internal_apps_app
WITH LOGIN
PASSWORD '<private-runtime-password>'
NOSUPERUSER
NOCREATEDB
NOCREATEROLE
NOINHERIT
NOREPLICATION
NOBYPASSRLS;
```

This is a manual administrator prerequisite. Do not run it as `internal_apps_owner`, place the real password in source control, or grant the runtime role ownership/administrative privileges.

Copy the environment template if `.env` does not exist, then edit `.env` with the approved host, private database passwords, a private admin initial password, and a random JWT signing key of at least 32 bytes:

```powershell
Copy-Item .env.example .env
dotnet run --project tools/migrator/InternalApps.Migrator.csproj
```

The runner loads `.env` from the repository root and constructs the owner connection string with `NpgsqlConnectionStringBuilder`. It validates all required database variables, the port, SSL mode, trust-certificate flag, and both passwords before connecting. Existing process environment variables take precedence over `.env`.

Do not paste real values into source files, documentation, shell history shared with others, or issue trackers. `.env` is ignored by Git. In managed environments, populate process variables from the approved secret mechanism instead.

Migration `001_create_platform_schemas_and_runtime_user.sql`:

- fails clearly when the administrator-created `internal_apps_app` role is missing;
- creates the `identity`, `core`, `audit`, and `vacation` schemas;
- grants only database `CONNECT` and schema `USAGE`;
- creates no application tables and grants no owner or administrative rights.

The migrator never reads, injects, changes, or logs `APP_DB_PASSWORD`. The owner role requires ownership of `internal_apps`, but it does not require `CREATEROLE` or PostgreSQL superuser access. DbUp creates and maintains its own migration journal table; no business or module tables are created in this task.

Migration `002_identity_v1.sql` creates six Authentication MVP tables and seeds:

- username `admin`;
- display name and role `Administrator`;
- permission `System.Admin`;
- a BCrypt hash produced from `ADMIN_INITIAL_PASSWORD`.

The plaintext admin password is read from `.env`, hashed in migrator memory, and never written to SQL, logs, or the database. Change `ADMIN_INITIAL_PASSWORD` from its placeholder before running migrations.

Migration `003_application_access.sql` creates `core.applications` and `identity.user_applications`, seeds the active Vacation application, and assigns it to the existing administrator. The runtime role receives read-only access to the application catalog and assignments; assignment writes remain owner-controlled.

Build the runner without applying migrations:

```powershell
dotnet build tools/migrator/InternalApps.Migrator.csproj
```

After running the migrator, verify the schemas and runtime role with `psql`:

```powershell
$env:PGPASSWORD = "<owner-password>"
psql --host "<approved-host>" --port 5432 --username internal_apps_owner --dbname internal_apps -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('identity', 'core', 'audit', 'vacation') ORDER BY schema_name;"
psql --host "<approved-host>" --port 5432 --username internal_apps_owner --dbname internal_apps -c "SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls FROM pg_catalog.pg_roles WHERE rolname = 'internal_apps_app';"
Remove-Item Env:PGPASSWORD
```

Expected schemas are `audit`, `core`, `identity`, and `vacation`. The role query must return `internal_apps_app` with all listed privilege flags set to `false`.

### Future API database configuration

The API connects with `internal_apps_app`. It must never receive `DB_OWNER_USER` or `DB_OWNER_PASSWORD`. Refresh tokens are stored only as hashes in `identity.refresh_tokens`, allowing independent sessions for multiple browsers or devices. Refresh rotates the current token atomically; logout revokes only the current session.

## Install Portal packages

From the repository root:

```powershell
Set-Location apps/portal
npm install
Set-Location ../..
```

## Run the API

From the repository root:

```powershell
$env:PORTAL_URL = "http://localhost:3000"
dotnet run --project apps/api/src/Api/InternalApps.Api.csproj --launch-profile http
```

The API loads database and JWT settings from the repository-root `.env`.

## Run the Portal

In a second PowerShell terminal from the repository root:

```powershell
Set-Location apps/portal
$env:NEXT_PUBLIC_API_BASE_URL = "http://localhost:5000"
npm run dev
```

## Local URLs

| Service | URL |
|---|---|
| API health | <http://localhost:5000/health> |
| API information | <http://localhost:5000/api/v1/system/info> |
| Portal | <http://localhost:3000> |

The current Portal flow is:

`Login → assigned applications → Vacation`

The Portal opens at the login page, redirects authenticated users to the dashboard, and displays only active applications assigned by the API. The Vacation card opens the protected `/vacation` placeholder.

## Validate Authentication MVP

Apply migrations, then start the API and Portal using the commands above. Open <http://localhost:3000>, sign in with username `admin` and the private `ADMIN_INITIAL_PASSWORD` used during migration, and confirm the dashboard displays the Administrator user and role.

API validation from PowerShell:

```powershell
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginBody = @{ username = "admin"; password = "<admin-password>" } | ConvertTo-Json

$login = Invoke-RestMethod `
  -Uri "http://localhost:5000/api/v1/auth/login" `
  -Method Post `
  -ContentType "application/json" `
  -Body $loginBody `
  -WebSession $session

$headers = @{ Authorization = "Bearer $($login.accessToken)" }
Invoke-RestMethod `
  -Uri "http://localhost:5000/api/v1/auth/me" `
  -Headers $headers `
  -WebSession $session

Invoke-RestMethod `
  -Uri "http://localhost:5000/api/v1/me/applications" `
  -Headers $headers `
  -WebSession $session

Invoke-RestMethod `
  -Uri "http://localhost:5000/api/v1/auth/refresh" `
  -Method Post `
  -WebSession $session

Invoke-RestMethod `
  -Uri "http://localhost:5000/api/v1/auth/logout" `
  -Method Post `
  -Headers $headers `
  -WebSession $session
```

The login response contains a short-lived JWT access token. The refresh token is received as an HttpOnly cookie and is not exposed to Portal JavaScript or browser storage.
The applications response for the seeded administrator contains exactly one active item: `vacation`, routed to `/vacation`.

## Validate builds

From the repository root:

```powershell
dotnet build apps/api/src/Api/InternalApps.Api.csproj
dotnet build tools/migrator/InternalApps.Migrator.csproj
Set-Location apps/portal
npm run build
```

## Documentation

Start with [`docs/PROJECT_INSTRUCTIONS.md`](docs/PROJECT_INSTRUCTIONS.md). Architecture and implementation standards are under [`docs/architecture/`](docs/architecture/) and [`docs/standards/`](docs/standards/).
