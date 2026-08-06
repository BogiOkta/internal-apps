CREATE FUNCTION vacation.delete_neutralized_leave_request(
    p_request_public_id uuid
)
RETURNS TABLE (
    employee_public_id uuid,
    leave_type_public_id uuid,
    leave_type_code text,
    date_from date,
    date_to date,
    working_days integer,
    previous_status text,
    source text,
    ledger_net_effect numeric,
    deleted_history_rows integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
    v_request_id bigint;
    v_employee_id bigint;
    v_leave_type_id bigint;
    v_leave_year integer;
BEGIN
    SELECT requests.id,
           requests.employee_id,
           requests.leave_type_id,
           extract(year FROM requests.date_from)::integer
    INTO v_request_id, v_employee_id, v_leave_type_id, v_leave_year
    FROM vacation.leave_requests AS requests
    WHERE requests.public_id = p_request_public_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(
        format('%s:%s:%s', v_employee_id, v_leave_type_id, v_leave_year),
        0));

    SELECT employees.public_id,
           leave_types.public_id,
           leave_types.code::text,
           requests.date_from,
           requests.date_to,
           requests.working_days,
           requests.status::text,
           requests.source::text,
           coalesce(sum(entries.quantity_days), 0)
    INTO employee_public_id,
         leave_type_public_id,
         leave_type_code,
         date_from,
         date_to,
         working_days,
         previous_status,
         source,
         ledger_net_effect
    FROM vacation.leave_requests AS requests
    INNER JOIN organization.employees AS employees
        ON employees.id = requests.employee_id
    INNER JOIN vacation.leave_types AS leave_types
        ON leave_types.id = requests.leave_type_id
    LEFT JOIN vacation.leave_balance_entries AS entries
        ON entries.leave_request_id = requests.id
    WHERE requests.id = v_request_id
    GROUP BY requests.id, employees.public_id, leave_types.public_id, leave_types.code;

    IF previous_status NOT IN ('REJECTED', 'CANCELLED') THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'leave_request_delete_conflict:v1:non_terminal_status';
    END IF;

    IF ledger_net_effect <> 0 THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'leave_request_delete_conflict:v1:ledger_effect_not_zero';
    END IF;

    DELETE FROM vacation.leave_request_history
    WHERE leave_request_id = v_request_id;
    GET DIAGNOSTICS deleted_history_rows = ROW_COUNT;

    DELETE FROM vacation.leave_requests
    WHERE id = v_request_id;

    RETURN NEXT;
EXCEPTION WHEN foreign_key_violation THEN
    RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'leave_request_delete_conflict:v1:protected_dependency';
END
$$;

ALTER FUNCTION vacation.delete_neutralized_leave_request(uuid)
OWNER TO internal_apps_owner;

REVOKE ALL
ON FUNCTION vacation.delete_neutralized_leave_request(uuid)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION vacation.delete_neutralized_leave_request(uuid)
TO internal_apps_app;
