DO $$
BEGIN
    IF to_regclass('vacation.leave_types') IS NULL THEN
        RAISE EXCEPTION
            'Migration 012 requires vacation.leave_types created by migration 006.';
    END IF;
END
$$;

ALTER TABLE vacation.leave_types
    ADD COLUMN requires_balance boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN vacation.leave_types.requires_balance IS
    'Whether a balance record is required before this leave type can be requested.';
