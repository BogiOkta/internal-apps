ALTER TABLE organization.employee_protected_dependencies
    ADD COLUMN dependency_name text NOT NULL
        DEFAULT 'Protected employee dependency';

ALTER TABLE organization.employee_protected_dependencies
    ALTER COLUMN dependency_name DROP DEFAULT,
    ADD CONSTRAINT ck_employee_protected_dependencies_name
        CHECK (dependency_name = btrim(dependency_name)
            AND dependency_name <> '');

ALTER TABLE organization.employee_protected_dependencies
    DROP CONSTRAINT employee_protected_dependencies_pkey,
    ADD CONSTRAINT pk_employee_protected_dependencies
        PRIMARY KEY (employee_id, dependency_name);

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
    IF TG_NARGS NOT IN (3, 5) THEN
        RAISE EXCEPTION
            'remember_employee_protected_dependency requires column, reference type, dependency name, and optional filter column/value';
    END IF;

    IF TG_NARGS = 5
       AND to_jsonb(NEW) ->> TG_ARGV[3] IS DISTINCT FROM TG_ARGV[4] THEN
        RETURN NEW;
    END IF;

    v_reference_value := to_jsonb(NEW) ->> TG_ARGV[0];
    IF v_reference_value IS NULL THEN
        RETURN NEW;
    END IF;

    IF TG_ARGV[1] = 'public_id' THEN
        SELECT employees.id INTO v_employee_id
        FROM organization.employees
        WHERE employees.public_id = v_reference_value::uuid;
    ELSIF TG_ARGV[1] = 'id' THEN
        v_employee_id := v_reference_value::bigint;
    ELSE
        RAISE EXCEPTION 'unsupported employee reference type: %', TG_ARGV[1];
    END IF;

    IF v_employee_id IS NOT NULL THEN
        INSERT INTO organization.employee_protected_dependencies
            (employee_id, dependency_name)
        VALUES (v_employee_id, TG_ARGV[2])
        ON CONFLICT (employee_id, dependency_name) DO NOTHING;
    END IF;

    RETURN NEW;
END
$$;

DROP TRIGGER trg_user_employee_links_remember_employee_dependency
ON core.user_employee_links;
DROP TRIGGER trg_leave_requests_remember_employee_dependency
ON vacation.leave_requests;
DROP TRIGGER trg_leave_balances_remember_employee_dependency
ON vacation.leave_balances;
DROP TRIGGER trg_leave_policies_remember_employee_dependency
ON vacation.leave_policies;
DROP TRIGGER trg_leave_balance_entries_remember_employee_dependency
ON vacation.leave_balance_entries;
DROP TRIGGER trg_audit_events_remember_employee_dependency
ON audit.audit_events;

CREATE TRIGGER trg_user_employee_links_remember_employee_dependency
AFTER INSERT OR UPDATE OF employee_id ON core.user_employee_links
FOR EACH ROW EXECUTE FUNCTION organization.remember_employee_protected_dependency(
    'employee_id', 'id', 'Identity user link');
CREATE TRIGGER trg_leave_requests_remember_employee_dependency
AFTER INSERT OR UPDATE OF employee_id ON vacation.leave_requests
FOR EACH ROW EXECUTE FUNCTION organization.remember_employee_protected_dependency(
    'employee_id', 'id', 'Vacation leave request');
CREATE TRIGGER trg_leave_balances_remember_employee_dependency
AFTER INSERT OR UPDATE OF employee_id ON vacation.leave_balances
FOR EACH ROW EXECUTE FUNCTION organization.remember_employee_protected_dependency(
    'employee_id', 'id', 'Vacation leave balance');
CREATE TRIGGER trg_leave_policies_remember_employee_dependency
AFTER INSERT OR UPDATE OF employee_id ON vacation.leave_policies
FOR EACH ROW EXECUTE FUNCTION organization.remember_employee_protected_dependency(
    'employee_id', 'id', 'Vacation leave policy');
CREATE TRIGGER trg_leave_balance_entries_remember_employee_dependency
AFTER INSERT OR UPDATE OF employee_id ON vacation.leave_balance_entries
FOR EACH ROW EXECUTE FUNCTION organization.remember_employee_protected_dependency(
    'employee_id', 'id', 'Vacation leave balance history');
CREATE TRIGGER trg_audit_events_remember_employee_dependency
AFTER INSERT OR UPDATE OF target_type, target_public_id ON audit.audit_events
FOR EACH ROW EXECUTE FUNCTION organization.remember_employee_protected_dependency(
    'target_public_id', 'public_id', 'Employee audit history',
    'target_type', 'employee');

INSERT INTO organization.employee_protected_dependencies
    (employee_id, dependency_name)
SELECT employee_id, dependency_name
FROM
(
    SELECT employee_id, 'Identity user link'::text AS dependency_name
    FROM core.user_employee_links
    UNION
    SELECT employee_id, 'Vacation leave request' FROM vacation.leave_requests
    UNION
    SELECT employee_id, 'Vacation leave balance' FROM vacation.leave_balances
    UNION
    SELECT employee_id, 'Vacation leave policy' FROM vacation.leave_policies
    UNION
    SELECT employee_id, 'Vacation leave balance history' FROM vacation.leave_balance_entries
    UNION
    SELECT employees.id, 'Employee audit history'
    FROM audit.audit_events
    INNER JOIN organization.employees
        ON employees.public_id = audit_events.target_public_id
    WHERE audit_events.target_type = 'employee'
) AS protected_employees
ON CONFLICT (employee_id, dependency_name) DO NOTHING;
