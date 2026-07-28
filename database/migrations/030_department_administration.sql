DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM identity.roles WHERE name = 'Administrator'
    ) THEN
        RAISE EXCEPTION 'Required Administrator role does not exist.';
    END IF;
END
$$;

INSERT INTO identity.permissions (code)
VALUES ('organization.departments.manage')
ON CONFLICT (code) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM identity.roles
INNER JOIN identity.permissions
    ON permissions.code = 'organization.departments.manage'
WHERE roles.name = 'Administrator'
ON CONFLICT (role_id, permission_id) DO NOTHING;

GRANT INSERT
(
    public_id,
    code,
    name,
    is_active
)
ON organization.departments TO internal_apps_app;

GRANT UPDATE
(
    name,
    is_active,
    updated_at
)
ON organization.departments TO internal_apps_app;

GRANT USAGE
ON SEQUENCE organization.departments_id_seq
TO internal_apps_app;

-- Department deletion has one same-module dependency (organization.employees); a direct
-- existence check is used instead of the cross-schema marker mechanism built for employees.
CREATE OR REPLACE FUNCTION organization.delete_unreferenced_department(
    p_department_public_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
    v_department_id bigint;
BEGIN
    SELECT departments.id
    INTO v_department_id
    FROM organization.departments
    WHERE departments.public_id = p_department_public_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM organization.employees
        WHERE employees.department_id = v_department_id
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            -- Internal grammar: department_delete_conflict:v1:<controlled-label>(|<controlled-label>)*.
            MESSAGE = 'department_delete_conflict:v1:Organization employee';
    END IF;

    DELETE FROM organization.departments
    WHERE departments.id = v_department_id;

    RETURN true;
EXCEPTION
    WHEN foreign_key_violation THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'department_delete_conflict';
END
$$;

ALTER FUNCTION organization.delete_unreferenced_department(uuid)
OWNER TO internal_apps_owner;

REVOKE ALL
ON FUNCTION organization.delete_unreferenced_department(uuid)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION organization.delete_unreferenced_department(uuid)
TO internal_apps_app;
