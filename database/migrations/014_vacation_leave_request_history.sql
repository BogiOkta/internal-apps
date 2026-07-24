CREATE TABLE vacation.leave_request_history
(
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id uuid NOT NULL DEFAULT gen_random_uuid(),
    leave_request_id bigint NOT NULL,
    previous_status varchar(20) NULL,
    new_status varchar(20) NOT NULL,
    changed_by_user_id bigint NOT NULL,
    comment varchar(1000) NULL,
    changed_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_vacation_leave_request_history_public_id UNIQUE (public_id),
    CONSTRAINT fk_vacation_leave_request_history_request
        FOREIGN KEY (leave_request_id)
        REFERENCES vacation.leave_requests (id),
    CONSTRAINT fk_vacation_leave_request_history_changed_by_user
        FOREIGN KEY (changed_by_user_id)
        REFERENCES identity.users (id),
    CONSTRAINT ck_vacation_leave_request_history_previous_status
        CHECK (
            previous_status IS NULL
            OR previous_status IN ('SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED')
        ),
    CONSTRAINT ck_vacation_leave_request_history_new_status
        CHECK (new_status IN ('SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED')),
    CONSTRAINT ck_vacation_leave_request_history_status_changed
        CHECK (previous_status IS NULL OR previous_status <> new_status)
);

CREATE INDEX ix_vacation_leave_request_history_request_changed_at
    ON vacation.leave_request_history (leave_request_id, changed_at);

CREATE INDEX ix_vacation_leave_request_history_new_status
    ON vacation.leave_request_history (new_status);
