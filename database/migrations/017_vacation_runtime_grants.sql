REVOKE ALL
ON vacation.leave_requests,
   vacation.leave_request_history,
   vacation.leave_balances
FROM PUBLIC;

GRANT SELECT
ON vacation.leave_requests,
   vacation.leave_request_history,
   vacation.leave_balances
TO internal_apps_app;

GRANT INSERT
(
    employee_id,
    leave_type_id,
    date_from,
    date_to,
    working_days,
    status,
    employee_note,
    submitted_at,
    created_by_user_id
)
ON vacation.leave_requests
TO internal_apps_app;

GRANT UPDATE
(
    status,
    decision_note,
    decided_at,
    decided_by_user_id,
    cancelled_at,
    cancelled_by_user_id,
    updated_at
)
ON vacation.leave_requests
TO internal_apps_app;

GRANT INSERT
(
    leave_request_id,
    previous_status,
    new_status,
    changed_by_user_id,
    comment
)
ON vacation.leave_request_history
TO internal_apps_app;

GRANT INSERT
(
    employee_id,
    leave_type_id,
    year,
    entitlement_days,
    carry_over_days,
    adjustment_days,
    used_days
)
ON vacation.leave_balances
TO internal_apps_app;

GRANT UPDATE
(
    entitlement_days,
    carry_over_days,
    adjustment_days,
    used_days,
    updated_at
)
ON vacation.leave_balances
TO internal_apps_app;

GRANT USAGE
ON SEQUENCE vacation.leave_requests_id_seq,
            vacation.leave_request_history_id_seq,
            vacation.leave_balances_id_seq
TO internal_apps_app;
