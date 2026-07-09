DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_roles
        WHERE rolname = 'internal_apps_app'
    ) THEN
        RAISE EXCEPTION
            'Required runtime role internal_apps_app does not exist. A PostgreSQL administrator must create it before running migrations.';
    END IF;
END
$$;

CREATE SCHEMA IF NOT EXISTS identity AUTHORIZATION internal_apps_owner;
CREATE SCHEMA IF NOT EXISTS core AUTHORIZATION internal_apps_owner;
CREATE SCHEMA IF NOT EXISTS audit AUTHORIZATION internal_apps_owner;
CREATE SCHEMA IF NOT EXISTS vacation AUTHORIZATION internal_apps_owner;

GRANT CONNECT ON DATABASE internal_apps TO internal_apps_app;
GRANT USAGE ON SCHEMA identity, core, audit, vacation TO internal_apps_app;
