CREATE TABLE vacation.leave_policies
(
    policy_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id uuid NOT NULL DEFAULT gen_random_uuid(),
    employee_id bigint NOT NULL,
    leave_year integer NOT NULL,
    annual_entitlement_days numeric(6, 2) NOT NULL,
    carry_over_days numeric(6, 2) NOT NULL DEFAULT 0,
    carry_over_expiration_date date,
    manual_adjustment_days numeric(6, 2) NOT NULL DEFAULT 0,
    notes varchar(1000),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_vacation_leave_policies_public_id UNIQUE (public_id),
    CONSTRAINT uq_vacation_leave_policies_employee_year
        UNIQUE (employee_id, leave_year),
    CONSTRAINT fk_vacation_leave_policies_employee
        FOREIGN KEY (employee_id) REFERENCES organization.employees (id),
    CONSTRAINT ck_vacation_leave_policies_year
        CHECK (leave_year BETWEEN 1900 AND 9999),
    CONSTRAINT ck_vacation_leave_policies_entitlement_nonnegative
        CHECK (annual_entitlement_days >= 0),
    CONSTRAINT ck_vacation_leave_policies_carry_over_nonnegative
        CHECK (carry_over_days >= 0)
);

CREATE INDEX ix_vacation_leave_policies_employee_id
    ON vacation.leave_policies (employee_id);

CREATE INDEX ix_vacation_leave_policies_leave_year
    ON vacation.leave_policies (leave_year);

REVOKE ALL ON vacation.leave_policies FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE
    ON vacation.leave_policies TO internal_apps_app;
GRANT USAGE ON SEQUENCE vacation.leave_policies_policy_id_seq
    TO internal_apps_app;
