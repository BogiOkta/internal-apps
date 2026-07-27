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
    v_dependency_names text;
BEGIN
    SELECT employees.id
    INTO v_employee_id
    FROM organization.employees
    WHERE employees.public_id = p_employee_public_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    SELECT string_agg(
        employee_protected_dependencies.dependency_name,
        ', ' ORDER BY employee_protected_dependencies.dependency_name)
    INTO v_dependency_names
    FROM organization.employee_protected_dependencies
    WHERE employee_protected_dependencies.employee_id = v_employee_id;

    IF v_dependency_names IS NOT NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'employee_delete_conflict',
            DETAIL = v_dependency_names;
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
