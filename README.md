# Internal Apps Platform

Minimal runnable foundation for the company’s internal business-process platform.

## Status

Phase 0 - Foundation

The foundation contains:

- optional local PostgreSQL in Docker Compose;
- an ASP.NET Core .NET 8 API;
- a Next.js TypeScript Portal with Tailwind CSS.

Authentication, database migrations, database tables, and business modules are intentionally not implemented yet.

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

The API does not connect to PostgreSQL yet.

## Run the Portal

In a second PowerShell terminal from the repository root:

```powershell
Set-Location apps/portal
$env:API_BASE_URL = "http://localhost:5000"
npm run dev
```

## Local URLs

| Service | URL |
|---|---|
| API health | <http://localhost:5000/health> |
| API information | <http://localhost:5000/api/v1/system/info> |
| Portal | <http://localhost:3000> |

The Portal calls the API information endpoint and displays whether it is reachable.

## Validate builds

From the repository root:

```powershell
dotnet build apps/api/src/Api/InternalApps.Api.csproj
Set-Location apps/portal
npm run build
```

## Documentation

Start with [`docs/PROJECT_INSTRUCTIONS.md`](docs/PROJECT_INSTRUCTIONS.md). Architecture and implementation standards are under [`docs/architecture/`](docs/architecture/) and [`docs/standards/`](docs/standards/).
