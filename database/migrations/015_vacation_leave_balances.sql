CREATE TABLE vacation.leave_balances
(
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id uuid NOT NULL DEFAULT gen_random_uuid(),
    employee_id bigint NOT NULL,
    leave_type_id bigint NOT NULL,
    year integer NOT NULL,
    entitlement_days integer NOT NULL DEFAULT 0,
    carry_over_days integer NOT NULL DEFAULT 0,
    adjustment_days integer NOT NULL DEFAULT 0,
    used_days integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_vacation_leave_balances_public_id UNIQUE (public_id),
    CONSTRAINT uq_vacation_leave_balances_employee_type_year
        UNIQUE (employee_id, leave_type_id, year),
    CONSTRAINT fk_vacation_leave_balances_employee
        FOREIGN KEY (employee_id)
        REFERENCES organization.employees (id),
    CONSTRAINT fk_vacation_leave_balances_leave_type
        FOREIGN KEY (leave_type_id)
        REFERENCES vacation.leave_types (id),
    CONSTRAINT ck_vacation_leave_balances_year
        CHECK (year BETWEEN 1900 AND 9999),
    CONSTRAINT ck_vacation_leave_balances_entitlement_nonnegative
        CHECK (entitlement_days >= 0),
    CONSTRAINT ck_vacation_leave_balances_carry_over_nonnegative
        CHECK (carry_over_days >= 0),
    CONSTRAINT ck_vacation_leave_balances_used_nonnegative
        CHECK (used_days >= 0),
    CONSTRAINT ck_vacation_leave_balances_available_nonnegative
        CHECK (entitlement_days + carry_over_days + adjustment_days >= 0),
    CONSTRAINT ck_vacation_leave_balances_used_within_available
        CHECK (
            used_days
            <= entitlement_days + carry_over_days + adjustment_days
        )
);

CREATE INDEX ix_vacation_leave_balances_employee_id
    ON vacation.leave_balances (employee_id);

CREATE INDEX ix_vacation_leave_balances_leave_type_id
    ON vacation.leave_balances (leave_type_id);

CREATE INDEX ix_vacation_leave_balances_year
    ON vacation.leave_balances (year);
