DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM identity.roles WHERE name = 'Administrator') THEN
        RAISE EXCEPTION 'Required Administrator role does not exist.';
    END IF;
END
$$;

CREATE TABLE core.user_employee_links
(
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id bigint NOT NULL,
    employee_id bigint NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by bigint NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by bigint NOT NULL,
    CONSTRAINT uq_user_employee_links_public_id UNIQUE (public_id),
    CONSTRAINT uq_user_employee_links_user_id UNIQUE (user_id),
    CONSTRAINT uq_user_employee_links_employee_id UNIQUE (employee_id),
    CONSTRAINT fk_user_employee_links_user
        FOREIGN KEY (user_id) REFERENCES identity.users (id),
    CONSTRAINT fk_user_employee_links_employee
        FOREIGN KEY (employee_id) REFERENCES organization.employees (id),
    CONSTRAINT fk_user_employee_links_created_by
        FOREIGN KEY (created_by) REFERENCES identity.users (id),
    CONSTRAINT fk_user_employee_links_updated_by
        FOREIGN KEY (updated_by) REFERENCES identity.users (id)
);

INSERT INTO identity.permissions (code)
VALUES ('organization.user-employee-links.manage')
ON CONFLICT (code) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM identity.roles
INNER JOIN identity.permissions
    ON permissions.code = 'organization.user-employee-links.manage'
WHERE roles.name = 'Administrator'
ON CONFLICT (role_id, permission_id) DO NOTHING;

GRANT SELECT ON core.user_employee_links TO internal_apps_app;
GRANT INSERT
(
    public_id,
    user_id,
    employee_id,
    created_by,
    updated_by
)
ON core.user_employee_links TO internal_apps_app;
GRANT UPDATE
(
    user_id,
    employee_id,
    updated_at,
    updated_by
)
ON core.user_employee_links TO internal_apps_app;
GRANT DELETE ON core.user_employee_links TO internal_apps_app;
GRANT USAGE ON SEQUENCE core.user_employee_links_id_seq TO internal_apps_app;
