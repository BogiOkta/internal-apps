CREATE SCHEMA IF NOT EXISTS organization;

DO $$
BEGIN
    IF to_regclass('vacation.departments') IS NULL THEN
        RAISE EXCEPTION
            'Migration 005 requires vacation.departments created by migration 004.';
    END IF;

    IF to_regclass('vacation.employees') IS NULL THEN
        RAISE EXCEPTION
            'Migration 005 requires vacation.employees created by migration 004.';
    END IF;

    IF to_regclass('organization.departments') IS NOT NULL
        OR to_regclass('organization.employees') IS NOT NULL THEN
        RAISE EXCEPTION
            'Migration 005 cannot continue because target Organization tables already exist.';
    END IF;
END
$$;

ALTER TABLE vacation.departments SET SCHEMA organization;
ALTER TABLE vacation.employees SET SCHEMA organization;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint AS constraints
        INNER JOIN pg_class AS source_table
            ON source_table.oid = constraints.conrelid
        INNER JOIN pg_namespace AS source_schema
            ON source_schema.oid = source_table.relnamespace
        INNER JOIN pg_class AS target_table
            ON target_table.oid = constraints.confrelid
        INNER JOIN pg_namespace AS target_schema
            ON target_schema.oid = target_table.relnamespace
        WHERE constraints.contype = 'f'
          AND source_schema.nspname = 'organization'
          AND source_table.relname = 'employees'
          AND target_schema.nspname = 'organization'
          AND target_table.relname = 'departments'
    ) THEN
        RAISE EXCEPTION
            'Migration 005 did not preserve the employee-to-department foreign key.';
    END IF;
END
$$;

GRANT USAGE ON SCHEMA organization TO internal_apps_app;
GRANT SELECT
ON organization.departments, organization.employees
TO internal_apps_app;
