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

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Leave balance entries require an existing operational leave request.';
        END IF;

        IF request_record.employee_id IS DISTINCT FROM NEW.employee_id
           OR request_record.leave_type_id IS DISTINCT FROM NEW.leave_type_id
           OR extract(year FROM request_record.date_from) IS DISTINCT FROM NEW.leave_year::numeric THEN
            RAISE EXCEPTION 'Leave request does not match the ledger balance scope.';
        END IF;

        IF NEW.entry_kind = 'request_consumption' THEN
            IF request_record.status IS DISTINCT FROM 'APPROVED' THEN
                RAISE EXCEPTION 'Request consumption requires an approved leave request.';
            END IF;

            IF NEW.quantity_days IS DISTINCT FROM -request_record.working_days::numeric THEN
                RAISE EXCEPTION 'Request consumption must negate the persisted request working-day quantity.';
            END IF;
        END IF;
    END IF;

    IF NEW.entry_kind = 'cancellation_reversal' THEN
        IF request_record.status IS DISTINCT FROM 'CANCELLED' THEN
            RAISE EXCEPTION 'Cancellation reversal requires a cancelled leave request.';
        END IF;

        SELECT * INTO original_entry
        FROM vacation.leave_balance_entries
        WHERE id = NEW.reverses_entry_id;

        IF original_entry.entry_kind IS DISTINCT FROM 'request_consumption'
           OR original_entry.leave_request_id IS DISTINCT FROM NEW.leave_request_id
           OR original_entry.employee_id IS DISTINCT FROM NEW.employee_id
           OR original_entry.leave_type_id IS DISTINCT FROM NEW.leave_type_id
           OR original_entry.leave_year IS DISTINCT FROM NEW.leave_year
           OR original_entry.quantity_days IS DISTINCT FROM -NEW.quantity_days THEN
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
