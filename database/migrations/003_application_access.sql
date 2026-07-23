CREATE TABLE core.applications (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id uuid NOT NULL DEFAULT gen_random_uuid(),
    code varchar(50) NOT NULL,
    name varchar(100) NOT NULL,
    description varchar(500),
    route varchar(200) NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_applications_public_id UNIQUE (public_id),
    CONSTRAINT uq_applications_code UNIQUE (code)
);

CREATE TABLE identity.user_applications (
    user_id bigint NOT NULL,
    application_id bigint NOT NULL,
    assigned_at timestamptz NOT NULL DEFAULT now(),
    assigned_by_user_id bigint,
    CONSTRAINT pk_user_applications PRIMARY KEY (user_id, application_id),
    CONSTRAINT fk_user_applications_user
        FOREIGN KEY (user_id) REFERENCES identity.users (id) ON DELETE CASCADE,
    CONSTRAINT fk_user_applications_application
        FOREIGN KEY (application_id) REFERENCES core.applications (id) ON DELETE CASCADE,
    CONSTRAINT fk_user_applications_assigned_by_user
        FOREIGN KEY (assigned_by_user_id) REFERENCES identity.users (id) ON DELETE SET NULL
);

INSERT INTO core.applications (
    code,
    name,
    description,
    route,
    is_active,
    sort_order
)
VALUES (
    'vacation',
    'Vacation',
    'Upravljanje godišnjim odmorima i odsustvima',
    '/vacation',
    true,
    10
)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    route = EXCLUDED.route,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

INSERT INTO identity.user_applications (
    user_id,
    application_id,
    assigned_by_user_id
)
SELECT
    users.id,
    applications.id,
    users.id
FROM identity.users AS users
INNER JOIN core.applications AS applications
    ON applications.code = 'vacation'
WHERE lower(users.username) = 'admin'
ON CONFLICT (user_id, application_id) DO NOTHING;

GRANT SELECT
ON core.applications, identity.user_applications
TO internal_apps_app;
