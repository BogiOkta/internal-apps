CREATE TABLE vacation.leave_balance_entries
(
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id uuid NOT NULL DEFAULT gen_random_uuid(),
    employee_id bigint NOT NULL,
    leave_type_id bigint NOT NULL,
    leave_year integer NOT NULL,
    entry_kind varchar(32) NOT NULL,
    quantity_days numeric(6, 1) NOT NULL,
    effective_date date NOT NULL,
    accepted_at timestamptz NOT NULL DEFAULT now(),
    actor_user_id bigint NULL,
    system_origin varchar(100) NULL,
    reason varchar(200) NOT NULL,
    explanation varchar(1000) NULL,
    source_reference varchar(100) NOT NULL,
    leave_request_id bigint NULL,
    reverses_entry_id bigint NULL,
    CONSTRAINT uq_vacation_leave_balance_entries_public_id UNIQUE (public_id),
    CONSTRAINT uq_vacation_leave_balance_entries_kind_source
        UNIQUE (entry_kind, source_reference),
    CONSTRAINT uq_vacation_leave_balance_entries_reverses_entry
        UNIQUE (reverses_entry_id),
    CONSTRAINT fk_vacation_leave_balance_entries_employee
        FOREIGN KEY (employee_id) REFERENCES organization.employees (id),
    CONSTRAINT fk_vacation_leave_balance_entries_leave_type
        FOREIGN KEY (leave_type_id) REFERENCES vacation.leave_types (id),
    CONSTRAINT fk_vacation_leave_balance_entries_actor
        FOREIGN KEY (actor_user_id) REFERENCES identity.users (id),
    CONSTRAINT fk_vacation_leave_balance_entries_request
        FOREIGN KEY (leave_request_id) REFERENCES vacation.leave_requests (id),
    CONSTRAINT fk_vacation_leave_balance_entries_reverses_entry
        FOREIGN KEY (reverses_entry_id) REFERENCES vacation.leave_balance_entries (id),
    CONSTRAINT ck_vacation_leave_balance_entries_year
        CHECK (leave_year BETWEEN 1900 AND 9999),
    CONSTRAINT ck_vacation_leave_balance_entries_effective_date_year
        CHECK (extract(year FROM effective_date) = leave_year),
    CONSTRAINT ck_vacation_leave_balance_entries_kind
        CHECK (entry_kind IN (
            'annual_entitlement', 'carry_over', 'manual_adjustment',
            'request_consumption', 'cancellation_reversal'
        )),
    CONSTRAINT ck_vacation_leave_balance_entries_nonzero_half_day
        CHECK (quantity_days <> 0 AND mod(abs(quantity_days) * 2, 1) = 0),
    CONSTRAINT ck_vacation_leave_balance_entries_actor_or_system
        CHECK ((actor_user_id IS NULL) <> (system_origin IS NULL)),
    CONSTRAINT ck_vacation_leave_balance_entries_reason_not_blank
        CHECK (btrim(reason) <> ''),
    CONSTRAINT ck_vacation_leave_balance_entries_source_reference_not_blank
        CHECK (btrim(source_reference) <> ''),
    CONSTRAINT ck_vacation_leave_balance_entries_cause_shape
        CHECK (
            (entry_kind IN ('annual_entitlement', 'carry_over', 'manual_adjustment')
                AND leave_request_id IS NULL AND reverses_entry_id IS NULL)
            OR
            (entry_kind = 'request_consumption'
                AND leave_request_id IS NOT NULL AND reverses_entry_id IS NULL
                AND quantity_days < 0
                AND source_reference = leave_request_id::text)
            OR
            (entry_kind = 'cancellation_reversal'
                AND leave_request_id IS NOT NULL AND reverses_entry_id IS NOT NULL
                AND quantity_days > 0
                AND source_reference = leave_request_id::text)
        )
);

CREATE INDEX ix_vacation_leave_balance_entries_scope_accepted_at
    ON vacation.leave_balance_entries
        (employee_id, leave_type_id, leave_year, accepted_at, id);

CREATE OR REPLACE FUNCTION vacation.enforce_leave_balance_entry_integrity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    request_record vacation.leave_requests%ROWTYPE;
    original_entry vacation.leave_balance_entries%ROWTYPE;
    resulting_balance numeric(18, 1);
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(
        format('%s:%s:%s', NEW.employee_id, NEW.leave_type_id, NEW.leave_year),
        0));

    IF NOT EXISTS (
        SELECT 1
        FROM vacation.leave_types
        WHERE id = NEW.leave_type_id
          AND requires_balance
    ) THEN
        RAISE EXCEPTION 'Leave balance entries require a balance-consuming Leave Type.';
    END IF;

    IF NEW.leave_request_id IS NOT NULL THEN
        SELECT * INTO request_record
        FROM vacation.leave_requests
        WHERE id = NEW.leave_request_id;

        IF request_record.employee_id <> NEW.employee_id
           OR request_record.leave_type_id <> NEW.leave_type_id
           OR extract(year FROM request_record.date_from) <> NEW.leave_year THEN
            RAISE EXCEPTION 'Leave request does not match the ledger balance scope.';
        END IF;

        IF NEW.entry_kind = 'request_consumption'
        THEN
            IF request_record.status <> 'APPROVED' THEN
                RAISE EXCEPTION 'Request consumption requires an approved leave request.';
            END IF;

            IF NEW.quantity_days <> -request_record.working_days THEN
                RAISE EXCEPTION 'Request consumption must negate the persisted request working-day quantity.';
            END IF;
        END IF;
    END IF;

    IF NEW.entry_kind = 'cancellation_reversal' THEN
        IF request_record.status <> 'CANCELLED' THEN
            RAISE EXCEPTION 'Cancellation reversal requires a cancelled leave request.';
        END IF;

        SELECT * INTO original_entry
        FROM vacation.leave_balance_entries
        WHERE id = NEW.reverses_entry_id;

        IF original_entry.entry_kind <> 'request_consumption'
           OR original_entry.leave_request_id <> NEW.leave_request_id
           OR original_entry.employee_id <> NEW.employee_id
           OR original_entry.leave_type_id <> NEW.leave_type_id
           OR original_entry.leave_year <> NEW.leave_year
           OR original_entry.quantity_days <> -NEW.quantity_days THEN
            RAISE EXCEPTION 'Cancellation reversal must exactly reverse its request consumption in the same balance scope.';
        END IF;
    END IF;

    SELECT coalesce(sum(quantity_days), 0) + NEW.quantity_days
    INTO resulting_balance
    FROM vacation.leave_balance_entries
    WHERE employee_id = NEW.employee_id
      AND leave_type_id = NEW.leave_type_id
      AND leave_year = NEW.leave_year;

    IF resulting_balance < 0 THEN
        RAISE EXCEPTION 'Leave balance entry would make the balance negative.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_vacation_leave_balance_entries_integrity
BEFORE INSERT ON vacation.leave_balance_entries
FOR EACH ROW EXECUTE FUNCTION vacation.enforce_leave_balance_entry_integrity();

CREATE OR REPLACE FUNCTION vacation.prevent_leave_balance_entry_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Leave balance entries are append-only.';
END;
$$;

CREATE TRIGGER trg_vacation_leave_balance_entries_append_only
BEFORE UPDATE OR DELETE ON vacation.leave_balance_entries
FOR EACH ROW EXECUTE FUNCTION vacation.prevent_leave_balance_entry_mutation();

REVOKE ALL ON vacation.leave_balance_entries FROM PUBLIC;
GRANT SELECT, INSERT ON vacation.leave_balance_entries TO internal_apps_app;
GRANT USAGE ON SEQUENCE vacation.leave_balance_entries_id_seq TO internal_apps_app;
