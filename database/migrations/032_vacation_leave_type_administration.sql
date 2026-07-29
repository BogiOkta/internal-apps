DO $$
BEGIN
    IF to_regclass('vacation.leave_types') IS NULL THEN
        RAISE EXCEPTION
            'Migration 032 requires vacation.leave_types created by migration 006.';
    END IF;

    IF to_regclass('vacation.leave_requests') IS NULL THEN
        RAISE EXCEPTION
            'Migration 032 requires vacation.leave_requests created by migration 013.';
    END IF;

    IF to_regclass('vacation.leave_balances') IS NULL THEN
        RAISE EXCEPTION
            'Migration 032 requires vacation.leave_balances created by migration 015.';
    END IF;

    IF to_regclass('vacation.leave_balance_entries') IS NULL THEN
        RAISE EXCEPTION
            'Migration 032 requires vacation.leave_balance_entries created by migration 020.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM identity.permissions
        WHERE code = 'vacation.leave-types.manage'
    ) THEN
        RAISE EXCEPTION
            'Migration 032 requires the vacation.leave-types.manage permission seeded by migration 007.';
    END IF;
END
$$;

-- Requires Balance is editable only while the leave type is unused. Migration 006
-- granted no UPDATE on requires_balance; migration 012 granted only INSERT. The
-- runtime role receives the column UPDATE grant here, and the application layer
-- enforces the unused-only rule.
GRANT UPDATE (requires_balance)
ON vacation.leave_types
TO internal_apps_app;

-- Leave Type deletion has three same-module dependencies. A direct existence check is
-- used instead of the cross-schema marker mechanism built for employees, matching the
-- department pattern established by migration 030.
CREATE OR REPLACE FUNCTION vacation.delete_unreferenced_leave_type(
    p_leave_type_public_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
    v_leave_type_id bigint;
    v_dependencies text[] := ARRAY[]::text[];
BEGIN
    SELECT leave_types.id
    INTO v_leave_type_id
    FROM vacation.leave_types AS leave_types
    WHERE leave_types.public_id = p_leave_type_public_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM vacation.leave_requests AS leave_requests
        WHERE leave_requests.leave_type_id = v_leave_type_id
    ) THEN
        v_dependencies := array_append(v_dependencies, 'Vacation leave request');
    END IF;

    IF EXISTS (
        SELECT 1
        FROM vacation.leave_balances AS leave_balances
        WHERE leave_balances.leave_type_id = v_leave_type_id
    ) THEN
        v_dependencies := array_append(v_dependencies, 'Vacation leave balance');
    END IF;

    IF EXISTS (
        SELECT 1
        FROM vacation.leave_balance_entries AS leave_balance_entries
        WHERE leave_balance_entries.leave_type_id = v_leave_type_id
    ) THEN
        v_dependencies := array_append(v_dependencies, 'Vacation leave balance entry');
    END IF;

    IF array_length(v_dependencies, 1) > 0 THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            -- Internal grammar: leave_type_delete_conflict:v1:<controlled-label>(|<controlled-label>)*.
            MESSAGE = 'leave_type_delete_conflict:v1:'
                || array_to_string(v_dependencies, '|');
    END IF;

    DELETE FROM vacation.leave_types
    WHERE leave_types.id = v_leave_type_id;

    RETURN true;
EXCEPTION
    WHEN foreign_key_violation THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'leave_type_delete_conflict';
END
$$;

ALTER FUNCTION vacation.delete_unreferenced_leave_type(uuid)
OWNER TO internal_apps_owner;

REVOKE ALL
ON FUNCTION vacation.delete_unreferenced_leave_type(uuid)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION vacation.delete_unreferenced_leave_type(uuid)
TO internal_apps_app;
