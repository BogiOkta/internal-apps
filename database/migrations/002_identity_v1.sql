CREATE TABLE identity.users (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id uuid NOT NULL DEFAULT gen_random_uuid(),
    username varchar(100) NOT NULL,
    display_name varchar(200) NOT NULL,
    password_hash varchar(200) NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by bigint,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by bigint,
    CONSTRAINT uq_users_public_id UNIQUE (public_id),
    CONSTRAINT fk_users_created_by FOREIGN KEY (created_by) REFERENCES identity.users (id),
    CONSTRAINT fk_users_updated_by FOREIGN KEY (updated_by) REFERENCES identity.users (id)
);

CREATE UNIQUE INDEX uq_users_username_ci
    ON identity.users (lower(username));

CREATE TABLE identity.refresh_tokens (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id bigint NOT NULL,
    token_hash varchar(128) NOT NULL,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    replaced_by_token_hash varchar(128),
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by bigint,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by bigint,
    CONSTRAINT uq_refresh_tokens_public_id UNIQUE (public_id),
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES identity.users (id),
    CONSTRAINT fk_refresh_tokens_created_by FOREIGN KEY (created_by) REFERENCES identity.users (id),
    CONSTRAINT fk_refresh_tokens_updated_by FOREIGN KEY (updated_by) REFERENCES identity.users (id)
);

CREATE INDEX ix_refresh_tokens_user_id
    ON identity.refresh_tokens (user_id);

CREATE UNIQUE INDEX uq_refresh_tokens_token_hash
    ON identity.refresh_tokens (token_hash);

CREATE TABLE identity.roles (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id uuid NOT NULL DEFAULT gen_random_uuid(),
    name varchar(100) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by bigint,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by bigint,
    CONSTRAINT uq_roles_public_id UNIQUE (public_id),
    CONSTRAINT uq_roles_name UNIQUE (name),
    CONSTRAINT fk_roles_created_by FOREIGN KEY (created_by) REFERENCES identity.users (id),
    CONSTRAINT fk_roles_updated_by FOREIGN KEY (updated_by) REFERENCES identity.users (id)
);

CREATE TABLE identity.permissions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id uuid NOT NULL DEFAULT gen_random_uuid(),
    code varchar(150) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by bigint,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by bigint,
    CONSTRAINT uq_permissions_public_id UNIQUE (public_id),
    CONSTRAINT uq_permissions_code UNIQUE (code),
    CONSTRAINT fk_permissions_created_by FOREIGN KEY (created_by) REFERENCES identity.users (id),
    CONSTRAINT fk_permissions_updated_by FOREIGN KEY (updated_by) REFERENCES identity.users (id)
);

CREATE TABLE identity.user_roles (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id bigint NOT NULL,
    role_id bigint NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by bigint,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by bigint,
    CONSTRAINT uq_user_roles_public_id UNIQUE (public_id),
    CONSTRAINT uq_user_roles_user_role UNIQUE (user_id, role_id),
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES identity.users (id),
    CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES identity.roles (id),
    CONSTRAINT fk_user_roles_created_by FOREIGN KEY (created_by) REFERENCES identity.users (id),
    CONSTRAINT fk_user_roles_updated_by FOREIGN KEY (updated_by) REFERENCES identity.users (id)
);

CREATE TABLE identity.role_permissions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id uuid NOT NULL DEFAULT gen_random_uuid(),
    role_id bigint NOT NULL,
    permission_id bigint NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by bigint,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by bigint,
    CONSTRAINT uq_role_permissions_public_id UNIQUE (public_id),
    CONSTRAINT uq_role_permissions_role_permission UNIQUE (role_id, permission_id),
    CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES identity.roles (id),
    CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES identity.permissions (id),
    CONSTRAINT fk_role_permissions_created_by FOREIGN KEY (created_by) REFERENCES identity.users (id),
    CONSTRAINT fk_role_permissions_updated_by FOREIGN KEY (updated_by) REFERENCES identity.users (id)
);

INSERT INTO identity.users (
    username,
    display_name,
    password_hash,
    created_at,
    updated_at
)
VALUES (
    'admin',
    'Administrator',
    __ADMIN_PASSWORD_HASH_SQL_EXPRESSION__,
    now(),
    now()
);

UPDATE identity.users
SET created_by = id,
    updated_by = id
WHERE username = 'admin';

INSERT INTO identity.roles (name, created_by, updated_by)
SELECT 'Administrator', id, id
FROM identity.users
WHERE username = 'admin';

INSERT INTO identity.permissions (code, created_by, updated_by)
SELECT 'System.Admin', id, id
FROM identity.users
WHERE username = 'admin';

INSERT INTO identity.user_roles (user_id, role_id, created_by, updated_by)
SELECT users.id, roles.id, users.id, users.id
FROM identity.users AS users
CROSS JOIN identity.roles AS roles
WHERE users.username = 'admin'
  AND roles.name = 'Administrator';

INSERT INTO identity.role_permissions (role_id, permission_id, created_by, updated_by)
SELECT roles.id, permissions.id, users.id, users.id
FROM identity.roles AS roles
CROSS JOIN identity.permissions AS permissions
CROSS JOIN identity.users AS users
WHERE roles.name = 'Administrator'
  AND permissions.code = 'System.Admin'
  AND users.username = 'admin';

GRANT SELECT
ON identity.users, identity.roles, identity.permissions, identity.user_roles, identity.role_permissions
TO internal_apps_app;

GRANT SELECT, INSERT, UPDATE
ON identity.refresh_tokens
TO internal_apps_app;

GRANT USAGE, SELECT
ON SEQUENCE identity.refresh_tokens_id_seq
TO internal_apps_app;
