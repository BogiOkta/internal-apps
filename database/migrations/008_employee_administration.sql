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
VALUES ('organization.employees.manage')
ON CONFLICT (code) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM identity.roles
INNER JOIN identity.permissions
    ON permissions.code = 'organization.employees.manage'
WHERE roles.name = 'Administrator'
ON CONFLICT (role_id, permission_id) DO NOTHING;

GRANT INSERT
(
    public_id,
    employee_number,
    first_name,
    last_name,
    email,
    department_id,
    employment_status
)
ON organization.employees TO internal_apps_app;

GRANT UPDATE
(
    first_name,
    last_name,
    email,
    department_id,
    employment_status,
    updated_at
)
ON organization.employees TO internal_apps_app;

GRANT USAGE
ON SEQUENCE organization.employees_id_seq
TO internal_apps_app;
