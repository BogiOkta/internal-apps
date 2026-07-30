ALTER TABLE vacation.leave_requests
    ADD COLUMN source varchar(30) NOT NULL DEFAULT 'EMPLOYEE_REQUEST',
    ADD CONSTRAINT ck_vacation_leave_requests_source
        CHECK (source IN ('EMPLOYEE_REQUEST', 'ADMINISTRATIVE_ENTRY'));

CREATE FUNCTION vacation.prevent_leave_request_source_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
    IF NEW.source IS DISTINCT FROM OLD.source THEN
        RAISE EXCEPTION 'leave request source is immutable';
    END IF;
    RETURN NEW;
END
$$;

CREATE TRIGGER trg_vacation_leave_requests_source_immutable
BEFORE UPDATE ON vacation.leave_requests
FOR EACH ROW EXECUTE FUNCTION vacation.prevent_leave_request_source_change();

GRANT INSERT (source, decided_at, decided_by_user_id)
ON vacation.leave_requests
TO internal_apps_app;
