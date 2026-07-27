ALTER TABLE core.user_employee_links
    DROP CONSTRAINT fk_user_employee_links_employee,
    ADD CONSTRAINT fk_user_employee_links_employee
        FOREIGN KEY (employee_id)
        REFERENCES organization.employees (id)
        ON DELETE NO ACTION;

ALTER TABLE vacation.leave_requests
    DROP CONSTRAINT fk_vacation_leave_requests_employee,
    ADD CONSTRAINT fk_vacation_leave_requests_employee
        FOREIGN KEY (employee_id)
        REFERENCES organization.employees (id)
        ON DELETE NO ACTION;

ALTER TABLE vacation.leave_balances
    DROP CONSTRAINT fk_vacation_leave_balances_employee,
    ADD CONSTRAINT fk_vacation_leave_balances_employee
        FOREIGN KEY (employee_id)
        REFERENCES organization.employees (id)
        ON DELETE NO ACTION;

ALTER TABLE vacation.leave_policies
    DROP CONSTRAINT fk_vacation_leave_policies_employee,
    ADD CONSTRAINT fk_vacation_leave_policies_employee
        FOREIGN KEY (employee_id)
        REFERENCES organization.employees (id)
        ON DELETE NO ACTION;

ALTER TABLE vacation.leave_balance_entries
    DROP CONSTRAINT fk_vacation_leave_balance_entries_employee,
    ADD CONSTRAINT fk_vacation_leave_balance_entries_employee
        FOREIGN KEY (employee_id)
        REFERENCES organization.employees (id)
        ON DELETE NO ACTION;

CREATE TABLE organization.employee_protected_dependencies
(
    employee_id bigint PRIMARY KEY,
    first_recorded_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_employee_protected_dependencies_employee
        FOREIGN KEY (employee_id)
        REFERENCES organization.employees (id)
        ON DELETE NO ACTION
);

REVOKE ALL
ON organization.employee_protected_dependencies
FROM PUBLIC, internal_apps_app;

CREATE OR REPLACE FUNCTION organization.remember_employee_protected_dependency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
    v_employee_id bigint;
    v_reference_value text;
BEGIN
    IF TG_NARGS NOT IN (2, 4) THEN
        RAISE EXCEPTION
            'remember_employee_protected_dependency requires column, reference type, and optional filter column/value';
    END IF;

    IF TG_NARGS = 4
       AND to_jsonb(NEW) ->> TG_ARGV[2] IS DISTINCT FROM TG_ARGV[3] THEN
        RETURN NEW;
    END IF;

    v_reference_value := to_jsonb(NEW) ->> TG_ARGV[0];
    IF v_reference_value IS NULL THEN
        RETURN NEW;
    END IF;

    IF TG_ARGV[1] = 'public_id' THEN
        SELECT employees.id
        INTO v_employee_id
        FROM organization.employees
        WHERE employees.public_id = v_reference_value::uuid;
    ELSIF TG_ARGV[1] = 'id' THEN
        v_employee_id := v_reference_value::bigint;
    ELSE
        RAISE EXCEPTION
            'unsupported employee reference type: %', TG_ARGV[1];
    END IF;

    IF v_employee_id IS NOT NULL THEN
        INSERT INTO organization.employee_protected_dependencies (employee_id)
        VALUES (v_employee_id)
        ON CONFLICT (employee_id) DO NOTHING;
    END IF;

    RETURN NEW;
END
$$;

ALTER FUNCTION organization.remember_employee_protected_dependency()
OWNER TO internal_apps_owner;

REVOKE ALL
ON FUNCTION organization.remember_employee_protected_dependency()
FROM PUBLIC;

CREATE TRIGGER trg_user_employee_links_remember_employee_dependency
AFTER INSERT OR UPDATE OF employee_id ON core.user_employee_links
FOR EACH ROW EXECUTE FUNCTION
    organization.remember_employee_protected_dependency(
        'employee_id', 'id');

CREATE TRIGGER trg_leave_requests_remember_employee_dependency
AFTER INSERT OR UPDATE OF employee_id ON vacation.leave_requests
FOR EACH ROW EXECUTE FUNCTION
    organization.remember_employee_protected_dependency(
        'employee_id', 'id');

CREATE TRIGGER trg_leave_balances_remember_employee_dependency
AFTER INSERT OR UPDATE OF employee_id ON vacation.leave_balances
FOR EACH ROW EXECUTE FUNCTION
    organization.remember_employee_protected_dependency(
        'employee_id', 'id');

CREATE TRIGGER trg_leave_policies_remember_employee_dependency
AFTER INSERT OR UPDATE OF employee_id ON vacation.leave_policies
FOR EACH ROW EXECUTE FUNCTION
    organization.remember_employee_protected_dependency(
        'employee_id', 'id');

CREATE TRIGGER trg_leave_balance_entries_remember_employee_dependency
AFTER INSERT OR UPDATE OF employee_id ON vacation.leave_balance_entries
FOR EACH ROW EXECUTE FUNCTION
    organization.remember_employee_protected_dependency(
        'employee_id', 'id');

CREATE TRIGGER trg_audit_events_remember_employee_dependency
AFTER INSERT OR UPDATE OF target_type, target_public_id ON audit.audit_events
FOR EACH ROW EXECUTE FUNCTION
    organization.remember_employee_protected_dependency(
        'target_public_id', 'public_id', 'target_type', 'employee');

INSERT INTO organization.employee_protected_dependencies (employee_id)
SELECT employee_id
FROM
(
    SELECT employee_id
    FROM core.user_employee_links
    UNION
    SELECT employee_id
    FROM vacation.leave_requests
    UNION
    SELECT employee_id
    FROM vacation.leave_balances
    UNION
    SELECT employee_id
    FROM vacation.leave_policies
    UNION
    SELECT employee_id
    FROM vacation.leave_balance_entries
    UNION
    SELECT employees.id
    FROM audit.audit_events
    INNER JOIN organization.employees
        ON employees.public_id = audit_events.target_public_id
    WHERE audit_events.target_type = 'employee'
) AS protected_employees
ON CONFLICT (employee_id) DO NOTHING;

CREATE OR REPLACE FUNCTION organization.delete_unreferenced_employee(
    p_employee_public_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
    v_employee_id bigint;
BEGIN
    SELECT employees.id
    INTO v_employee_id
    FROM organization.employees
    WHERE employees.public_id = p_employee_public_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM organization.employee_protected_dependencies
        WHERE employee_protected_dependencies.employee_id = v_employee_id
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'employee_delete_conflict';
    END IF;

    DELETE FROM organization.employees
    WHERE employees.id = v_employee_id;

    RETURN true;
EXCEPTION
    WHEN foreign_key_violation THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'employee_delete_conflict';
END
$$;

ALTER FUNCTION organization.delete_unreferenced_employee(uuid)
OWNER TO internal_apps_owner;

REVOKE ALL
ON FUNCTION organization.delete_unreferenced_employee(uuid)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION organization.delete_unreferenced_employee(uuid)
TO internal_apps_app;
