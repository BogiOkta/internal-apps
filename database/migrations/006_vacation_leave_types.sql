CREATE TABLE vacation.leave_types
(
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id uuid NOT NULL DEFAULT gen_random_uuid(),
    code varchar(50) NOT NULL,
    name_sr varchar(150) NOT NULL,
    name_en varchar(150) NOT NULL,
    description_sr varchar(500) NULL,
    description_en varchar(500) NULL,
    calendar_color varchar(20) NULL,
    counts_against_vacation_balance boolean NOT NULL DEFAULT false,
    requires_approval boolean NOT NULL DEFAULT true,
    is_active boolean NOT NULL DEFAULT true,
    display_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_vacation_leave_types_public_id UNIQUE (public_id),
    CONSTRAINT ck_vacation_leave_types_code_not_blank CHECK (btrim(code) <> ''),
    CONSTRAINT ck_vacation_leave_types_code_format
        CHECK (code ~ '^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$'),
    CONSTRAINT ck_vacation_leave_types_name_sr_not_blank CHECK (btrim(name_sr) <> ''),
    CONSTRAINT ck_vacation_leave_types_name_en_not_blank CHECK (btrim(name_en) <> ''),
    CONSTRAINT ck_vacation_leave_types_display_order CHECK (display_order >= 0)
);

CREATE UNIQUE INDEX uq_vacation_leave_types_code_ci
    ON vacation.leave_types (lower(code));

CREATE INDEX ix_vacation_leave_types_active_display_order
    ON vacation.leave_types (display_order, name_sr)
    WHERE is_active = true;

INSERT INTO vacation.leave_types
(
    code,
    name_sr,
    name_en,
    counts_against_vacation_balance,
    requires_approval,
    is_active,
    display_order
)
VALUES
    ('ANNUAL_LEAVE', 'Godišnji odmor', 'Annual leave', true, true, true, 10),
    ('PAID_LEAVE', 'Plaćeno odsustvo', 'Paid leave', false, true, true, 20),
    ('UNPAID_LEAVE', 'Neplaćeno odsustvo', 'Unpaid leave', false, true, true, 30),
    ('SICK_LEAVE', 'Bolovanje', 'Sick leave', false, true, true, 40),
    ('OTHER', 'Ostalo odsustvo', 'Other leave', false, true, true, 50)
ON CONFLICT ((lower(code))) DO NOTHING;

GRANT SELECT ON vacation.leave_types TO internal_apps_app;

GRANT INSERT
(
    code,
    name_sr,
    name_en,
    description_sr,
    description_en,
    calendar_color,
    counts_against_vacation_balance,
    requires_approval,
    is_active,
    display_order
)
ON vacation.leave_types TO internal_apps_app;

GRANT UPDATE
(
    name_sr,
    name_en,
    description_sr,
    description_en,
    calendar_color,
    counts_against_vacation_balance,
    requires_approval,
    is_active,
    display_order,
    updated_at
)
ON vacation.leave_types TO internal_apps_app;

GRANT USAGE, SELECT ON SEQUENCE vacation.leave_types_id_seq TO internal_apps_app;
