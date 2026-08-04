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
VALUES ('vacation.leave-balances.manage')
ON CONFLICT (code) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM identity.roles
INNER JOIN identity.permissions
    ON permissions.code = 'vacation.leave-balances.manage'
WHERE roles.name = 'Administrator'
ON CONFLICT (role_id, permission_id) DO NOTHING;
