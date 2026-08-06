ALTER TABLE vacation.leave_types
    ADD COLUMN is_system boolean NOT NULL DEFAULT false;

UPDATE vacation.leave_types
SET is_system = true
WHERE code IN ('ANNUAL_LEAVE', 'PAID_LEAVE', 'UNPAID_LEAVE', 'SICK_LEAVE', 'OTHER');

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
    v_is_system boolean;
    v_dependencies text;
BEGIN
    SELECT leave_types.id, leave_types.is_system
    INTO v_leave_type_id, v_is_system
    FROM vacation.leave_types AS leave_types
    WHERE leave_types.public_id = p_leave_type_public_id
    FOR UPDATE;

    IF NOT FOUND THEN RETURN false; END IF;

    IF v_is_system THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001',
            MESSAGE = 'leave_type_delete_conflict:v1:System leave type';
    END IF;

    SELECT string_agg(dependency_name, '|' ORDER BY dependency_name)
    INTO v_dependencies
    FROM vacation.leave_type_protected_dependencies
    WHERE leave_type_id = v_leave_type_id;

    IF v_dependencies IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001',
            MESSAGE = 'leave_type_delete_conflict:v1:' || v_dependencies;
    END IF;

    DELETE FROM vacation.leave_types WHERE id = v_leave_type_id;
    RETURN true;
EXCEPTION WHEN foreign_key_violation THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'leave_type_delete_conflict';
END
$$;

ALTER FUNCTION vacation.delete_unreferenced_leave_type(uuid) OWNER TO internal_apps_owner;
REVOKE ALL ON FUNCTION vacation.delete_unreferenced_leave_type(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION vacation.delete_unreferenced_leave_type(uuid) TO internal_apps_app;
