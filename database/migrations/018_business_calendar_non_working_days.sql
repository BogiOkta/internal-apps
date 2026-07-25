CREATE TABLE core.non_working_days (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id uuid NOT NULL DEFAULT gen_random_uuid(),
    date date NOT NULL,
    name varchar(200) NOT NULL,
    description varchar(1000),
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by bigint NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by bigint NOT NULL,
    CONSTRAINT uq_non_working_days_public_id UNIQUE (public_id),
    CONSTRAINT uq_non_working_days_date UNIQUE (date),
    CONSTRAINT ck_non_working_days_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT fk_non_working_days_created_by
        FOREIGN KEY (created_by) REFERENCES identity.users (id),
    CONSTRAINT fk_non_working_days_updated_by
        FOREIGN KEY (updated_by) REFERENCES identity.users (id)
);

REVOKE ALL ON core.non_working_days FROM PUBLIC;

GRANT SELECT ON core.non_working_days TO internal_apps_app;

GRANT INSERT
(
    public_id,
    date,
    name,
    description,
    created_by,
    updated_by
)
ON core.non_working_days TO internal_apps_app;

GRANT UPDATE
(
    date,
    name,
    description,
    updated_at,
    updated_by
)
ON core.non_working_days TO internal_apps_app;

GRANT DELETE ON core.non_working_days TO internal_apps_app;

GRANT USAGE ON SEQUENCE core.non_working_days_id_seq TO internal_apps_app;
