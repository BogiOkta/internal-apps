REVOKE INSERT, UPDATE, DELETE
ON identity.user_roles
FROM internal_apps_app;

REVOKE INSERT
(
    public_id,
    user_id,
    role_id,
    created_by,
    updated_by
)
ON identity.user_roles
FROM internal_apps_app;

REVOKE USAGE
ON SEQUENCE identity.user_roles_id_seq
FROM internal_apps_app;

CREATE OR REPLACE FUNCTION identity.assign_base_user_role(
    p_user_public_id uuid,
    p_actor_id bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
    v_user_id bigint;
    v_role_id bigint;
BEGIN
    SELECT users.id
    INTO STRICT v_user_id
    FROM identity.users
    WHERE users.public_id = p_user_public_id;

    SELECT roles.id
    INTO STRICT v_role_id
    FROM identity.roles
    WHERE roles.name = 'User';

    INSERT INTO identity.user_roles
        (public_id, user_id, role_id, created_by, updated_by)
    VALUES
        (pg_catalog.gen_random_uuid(), v_user_id, v_role_id, p_actor_id, p_actor_id);
END
$$;

ALTER FUNCTION identity.assign_base_user_role(uuid, bigint)
OWNER TO internal_apps_owner;

REVOKE ALL
ON FUNCTION identity.assign_base_user_role(uuid, bigint)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION identity.assign_base_user_role(uuid, bigint)
TO internal_apps_app;
