INSERT INTO vacation.leave_types
(
    code,
    name_sr,
    name_en,
    counts_against_vacation_balance,
    requires_approval,
    requires_balance,
    is_active,
    display_order
)
VALUES
    ('ANNUAL_LEAVE', 'Godišnji odmor', 'Annual leave', true, true, true, true, 10),
    ('PAID_LEAVE', 'Plaćeno odsustvo', 'Paid leave', false, true, false, true, 20),
    ('UNPAID_LEAVE', 'Neplaćeno odsustvo', 'Unpaid leave', false, true, false, true, 30),
    ('SICK_LEAVE', 'Bolovanje', 'Sick leave', false, true, false, true, 40),
    ('OTHER', 'Ostalo odsustvo', 'Other leave', false, true, false, true, 50)
ON CONFLICT ((lower(code))) DO NOTHING;

UPDATE vacation.leave_types
SET requires_balance = (code = 'ANNUAL_LEAVE'),
    updated_at = now()
WHERE code IN (
    'ANNUAL_LEAVE',
    'PAID_LEAVE',
    'UNPAID_LEAVE',
    'SICK_LEAVE',
    'OTHER'
)
AND requires_balance IS DISTINCT FROM (code = 'ANNUAL_LEAVE');
