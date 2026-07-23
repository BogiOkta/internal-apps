DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM core.applications
        WHERE code = 'vacation'
    ) THEN
        RAISE EXCEPTION
            'Required Vacation application does not exist.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM identity.roles
        WHERE name = 'Administrator'
    ) THEN
        RAISE EXCEPTION
            'Required Administrator role does not exist.';
    END IF;

END
$$;

INSERT INTO identity.permissions (
    code
)
VALUES (
    'vacation.leave-types.manage'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO identity.role_permissions (
    role_id,
    permission_id
)
SELECT
    roles.id,
    permissions.id
FROM identity.roles AS roles
INNER JOIN identity.permissions AS permissions
    ON permissions.code = 'vacation.leave-types.manage'
WHERE roles.name = 'Administrator'
ON CONFLICT (role_id, permission_id) DO NOTHING;

CREATE TABLE audit.audit_events
(
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id uuid NOT NULL DEFAULT gen_random_uuid(),
    occurred_at timestamptz NOT NULL DEFAULT now(),
    actor_user_public_id uuid NULL,
    actor_system_code varchar(100) NULL,
    module varchar(50) NOT NULL,
    action varchar(100) NOT NULL,
    target_type varchar(100) NOT NULL,
    target_public_id uuid NOT NULL,
    outcome varchar(50) NOT NULL,
    trace_id varchar(100) NOT NULL,
    CONSTRAINT uq_audit_events_public_id UNIQUE (public_id),
    CONSTRAINT ck_audit_events_exactly_one_actor CHECK
    (
        (
            actor_user_public_id IS NOT NULL
            AND actor_system_code IS NULL
        )
        OR
        (
            actor_user_public_id IS NULL
            AND actor_system_code IS NOT NULL
            AND btrim(actor_system_code) <> ''
        )
    )
);

CREATE INDEX ix_audit_events_target
    ON audit.audit_events (module, target_type, target_public_id, occurred_at);

CREATE INDEX ix_audit_events_actor
    ON audit.audit_events (actor_user_public_id, occurred_at);

CREATE TABLE audit.audit_details
(
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id uuid NOT NULL DEFAULT gen_random_uuid(),
    audit_event_public_id uuid NOT NULL,
    field_name varchar(100) NOT NULL,
    previous_value varchar(500) NULL,
    new_value varchar(500) NULL,
    CONSTRAINT uq_audit_details_public_id UNIQUE (public_id),
    CONSTRAINT fk_audit_details_event
        FOREIGN KEY (audit_event_public_id)
        REFERENCES audit.audit_events (public_id)
);

CREATE INDEX ix_audit_details_event
    ON audit.audit_details (audit_event_public_id);

GRANT INSERT
(
    public_id,
    actor_user_public_id,
    actor_system_code,
    module,
    action,
    target_type,
    target_public_id,
    outcome,
    trace_id
)
ON audit.audit_events TO internal_apps_app;

GRANT INSERT
(
    public_id,
    audit_event_public_id,
    field_name,
    previous_value,
    new_value
)
ON audit.audit_details TO internal_apps_app;

GRANT USAGE
ON SEQUENCE audit.audit_events_id_seq, audit.audit_details_id_seq
TO internal_apps_app;
