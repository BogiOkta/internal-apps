DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM identity.roles WHERE name = 'Administrator') THEN
        RAISE EXCEPTION 'Required Administrator role does not exist.';
    END IF;
END
$$;

INSERT INTO identity.roles (name)
VALUES ('User')
ON CONFLICT (name) DO NOTHING;

INSERT INTO identity.permissions (code)
VALUES ('identity.users.manage')
ON CONFLICT (code) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM identity.roles
INNER JOIN identity.permissions ON permissions.code = 'identity.users.manage'
WHERE roles.name = 'Administrator'
ON CONFLICT (role_id, permission_id) DO NOTHING;

GRANT INSERT
(
    public_id,
    username,
    display_name,
    password_hash,
    is_active,
    created_by,
    updated_by
)
ON identity.users TO internal_apps_app;

GRANT UPDATE
(
    is_active,
    updated_at,
    updated_by
)
ON identity.users TO internal_apps_app;

GRANT INSERT
(
    public_id,
    user_id,
    role_id,
    created_by,
    updated_by
)
ON identity.user_roles TO internal_apps_app;

GRANT USAGE
ON SEQUENCE identity.users_id_seq, identity.user_roles_id_seq
TO internal_apps_app;
