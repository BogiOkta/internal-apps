ALTER TABLE vacation.leave_balances
    ALTER COLUMN entitlement_days TYPE numeric(6, 1),
    ALTER COLUMN carry_over_days TYPE numeric(6, 1),
    ALTER COLUMN adjustment_days TYPE numeric(6, 1);
