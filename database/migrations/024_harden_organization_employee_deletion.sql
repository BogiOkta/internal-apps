REVOKE DELETE
ON organization.employees
FROM internal_apps_app;

CREATE OR REPLACE FUNCTION organization.delete_unreferenced_employee(
    p_employee_public_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
    v_employee_id bigint;
BEGIN
    SELECT employees.id
    INTO v_employee_id
    FROM organization.employees
    WHERE employees.public_id = p_employee_public_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM core.user_employee_links
        WHERE user_employee_links.employee_id = v_employee_id
    )
    OR EXISTS (
        SELECT 1
        FROM vacation.leave_requests
        WHERE leave_requests.employee_id = v_employee_id
    )
    OR EXISTS (
        SELECT 1
        FROM vacation.leave_balances
        WHERE leave_balances.employee_id = v_employee_id
    )
    OR EXISTS (
        SELECT 1
        FROM vacation.leave_policies
        WHERE leave_policies.employee_id = v_employee_id
    )
    OR EXISTS (
        SELECT 1
        FROM vacation.leave_balance_entries
        WHERE leave_balance_entries.employee_id = v_employee_id
    )
    OR EXISTS (
        SELECT 1
        FROM audit.audit_events
        WHERE audit_events.target_type = 'employee'
          AND audit_events.target_public_id = p_employee_public_id
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'employee_delete_conflict';
    END IF;

    DELETE FROM organization.employees
    WHERE employees.id = v_employee_id;

    RETURN true;
EXCEPTION
    WHEN foreign_key_violation THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'employee_delete_conflict';
END
$$;

ALTER FUNCTION organization.delete_unreferenced_employee(uuid)
OWNER TO internal_apps_owner;

REVOKE ALL
ON FUNCTION organization.delete_unreferenced_employee(uuid)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION organization.delete_unreferenced_employee(uuid)
TO internal_apps_app;
