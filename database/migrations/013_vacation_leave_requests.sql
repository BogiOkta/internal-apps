CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE vacation.leave_requests
(
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id uuid NOT NULL DEFAULT gen_random_uuid(),
    employee_id bigint NOT NULL,
    leave_type_id bigint NOT NULL,
    date_from date NOT NULL,
    date_to date NOT NULL,
    working_days integer NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'SUBMITTED',
    employee_note varchar(1000) NULL,
    decision_note varchar(1000) NULL,
    submitted_at timestamptz NOT NULL DEFAULT now(),
    decided_at timestamptz NULL,
    decided_by_user_id bigint NULL,
    cancelled_at timestamptz NULL,
    cancelled_by_user_id bigint NULL,
    created_by_user_id bigint NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_vacation_leave_requests_public_id UNIQUE (public_id),
    CONSTRAINT fk_vacation_leave_requests_employee
        FOREIGN KEY (employee_id)
        REFERENCES organization.employees (id),
    CONSTRAINT fk_vacation_leave_requests_leave_type
        FOREIGN KEY (leave_type_id)
        REFERENCES vacation.leave_types (id),
    CONSTRAINT fk_vacation_leave_requests_decided_by_user
        FOREIGN KEY (decided_by_user_id)
        REFERENCES identity.users (id),
    CONSTRAINT fk_vacation_leave_requests_cancelled_by_user
        FOREIGN KEY (cancelled_by_user_id)
        REFERENCES identity.users (id),
    CONSTRAINT fk_vacation_leave_requests_created_by_user
        FOREIGN KEY (created_by_user_id)
        REFERENCES identity.users (id),
    CONSTRAINT ck_vacation_leave_requests_date_order
        CHECK (date_to >= date_from),
    CONSTRAINT ck_vacation_leave_requests_single_year
        CHECK (extract(year FROM date_from) = extract(year FROM date_to)),
    CONSTRAINT ck_vacation_leave_requests_working_days_positive
        CHECK (working_days > 0),
    CONSTRAINT ck_vacation_leave_requests_status
        CHECK (status IN ('SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED')),
    CONSTRAINT ck_vacation_leave_requests_decision_pair
        CHECK (
            (decided_at IS NULL AND decided_by_user_id IS NULL)
            OR
            (decided_at IS NOT NULL AND decided_by_user_id IS NOT NULL)
        ),
    CONSTRAINT ck_vacation_leave_requests_cancellation_pair
        CHECK (
            (cancelled_at IS NULL AND cancelled_by_user_id IS NULL)
            OR
            (cancelled_at IS NOT NULL AND cancelled_by_user_id IS NOT NULL)
        ),
    CONSTRAINT ck_vacation_leave_requests_status_metadata
        CHECK (
            (
                status = 'SUBMITTED'
                AND decided_at IS NULL
                AND decided_by_user_id IS NULL
                AND cancelled_at IS NULL
                AND cancelled_by_user_id IS NULL
            )
            OR
            (
                status IN ('APPROVED', 'REJECTED')
                AND decided_at IS NOT NULL
                AND decided_by_user_id IS NOT NULL
                AND cancelled_at IS NULL
                AND cancelled_by_user_id IS NULL
            )
            OR
            (
                status = 'CANCELLED'
                AND cancelled_at IS NOT NULL
                AND cancelled_by_user_id IS NOT NULL
            )
        ),
    CONSTRAINT ex_vacation_leave_requests_employee_active_overlap
        EXCLUDE USING gist
        (
            employee_id WITH =,
            daterange(date_from, date_to, '[]') WITH &&
        )
        WHERE (status IN ('SUBMITTED', 'APPROVED'))
);

CREATE INDEX ix_vacation_leave_requests_employee_id
    ON vacation.leave_requests (employee_id);

CREATE INDEX ix_vacation_leave_requests_status
    ON vacation.leave_requests (status);

CREATE INDEX ix_vacation_leave_requests_date_from
    ON vacation.leave_requests (date_from);

CREATE INDEX ix_vacation_leave_requests_date_to
    ON vacation.leave_requests (date_to);

CREATE INDEX ix_vacation_leave_requests_leave_type_id
    ON vacation.leave_requests (leave_type_id);
