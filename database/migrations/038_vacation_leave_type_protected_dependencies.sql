CREATE TABLE vacation.leave_type_protected_dependencies
(
    leave_type_id bigint NOT NULL,
    dependency_name text NOT NULL,
    first_recorded_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_vacation_leave_type_protected_dependencies
        PRIMARY KEY (leave_type_id, dependency_name),
    CONSTRAINT fk_vacation_leave_type_protected_dependencies_leave_type
        FOREIGN KEY (leave_type_id) REFERENCES vacation.leave_types (id) ON DELETE NO ACTION,
    CONSTRAINT ck_vacation_leave_type_protected_dependencies_name
        CHECK (dependency_name = btrim(dependency_name) AND dependency_name <> '')
);

REVOKE ALL ON vacation.leave_type_protected_dependencies FROM PUBLIC, internal_apps_app;

CREATE OR REPLACE FUNCTION vacation.remember_leave_type_protected_dependency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
    v_leave_type_id bigint;
BEGIN
    IF TG_NARGS <> 3 THEN
        RAISE EXCEPTION 'remember_leave_type_protected_dependency requires column, reference type, and dependency name';
    END IF;

    IF TG_ARGV[1] IS DISTINCT FROM 'id' THEN
        RAISE EXCEPTION 'unsupported Leave Type reference type: %', TG_ARGV[1];
    END IF;

    v_leave_type_id := (to_jsonb(NEW) ->> TG_ARGV[0])::bigint;
    IF v_leave_type_id IS NOT NULL THEN
        INSERT INTO vacation.leave_type_protected_dependencies
            (leave_type_id, dependency_name)
        VALUES (v_leave_type_id, TG_ARGV[2])
        ON CONFLICT (leave_type_id, dependency_name) DO NOTHING;
    END IF;

    RETURN NEW;
END
$$;

ALTER FUNCTION vacation.remember_leave_type_protected_dependency()
OWNER TO internal_apps_owner;

CREATE TRIGGER trg_leave_requests_remember_leave_type_dependency
AFTER INSERT OR UPDATE OF leave_type_id ON vacation.leave_requests
FOR EACH ROW EXECUTE FUNCTION vacation.remember_leave_type_protected_dependency(
    'leave_type_id', 'id', 'Vacation leave request');
CREATE TRIGGER trg_leave_balances_remember_leave_type_dependency
AFTER INSERT OR UPDATE OF leave_type_id ON vacation.leave_balances
FOR EACH ROW EXECUTE FUNCTION vacation.remember_leave_type_protected_dependency(
    'leave_type_id', 'id', 'Vacation leave balance');
CREATE TRIGGER trg_leave_balance_entries_remember_leave_type_dependency
AFTER INSERT OR UPDATE OF leave_type_id ON vacation.leave_balance_entries
FOR EACH ROW EXECUTE FUNCTION vacation.remember_leave_type_protected_dependency(
    'leave_type_id', 'id', 'Vacation leave balance entry');

INSERT INTO vacation.leave_type_protected_dependencies (leave_type_id, dependency_name)
SELECT leave_type_id, dependency_name
FROM (
    SELECT leave_type_id, 'Vacation leave request'::text AS dependency_name FROM vacation.leave_requests
    UNION
    SELECT leave_type_id, 'Vacation leave balance' FROM vacation.leave_balances
    UNION
    SELECT leave_type_id, 'Vacation leave balance entry' FROM vacation.leave_balance_entries
) AS protected_leave_types
ON CONFLICT (leave_type_id, dependency_name) DO NOTHING;

CREATE OR REPLACE FUNCTION vacation.delete_unreferenced_leave_type(
    p_leave_type_public_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
    v_leave_type_id bigint;
    v_dependencies text;
BEGIN
    SELECT leave_types.id INTO v_leave_type_id
    FROM vacation.leave_types AS leave_types
    WHERE leave_types.public_id = p_leave_type_public_id
    FOR UPDATE;

    IF NOT FOUND THEN RETURN false; END IF;

    SELECT string_agg(dependency_name, '|' ORDER BY dependency_name)
    INTO v_dependencies
    FROM vacation.leave_type_protected_dependencies
    WHERE leave_type_id = v_leave_type_id;

    IF v_dependencies IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001',
            MESSAGE = 'leave_type_delete_conflict:v1:' || v_dependencies;
    END IF;

    DELETE FROM vacation.leave_types WHERE id = v_leave_type_id;
    RETURN true;
EXCEPTION WHEN foreign_key_violation THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'leave_type_delete_conflict';
END
$$;

ALTER FUNCTION vacation.delete_unreferenced_leave_type(uuid) OWNER TO internal_apps_owner;
REVOKE ALL ON FUNCTION vacation.delete_unreferenced_leave_type(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION vacation.delete_unreferenced_leave_type(uuid) TO internal_apps_app;
