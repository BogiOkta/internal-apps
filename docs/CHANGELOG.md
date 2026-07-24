# Internal Apps Platform change history

## 2026-07-24 — Sprint 04B/04C validated

- Completed explicit optional one-to-one Identity User ↔ Organization Employee
  linking through `core.user_employee_links`, with audited create, change, and
  unlink operations.
- Established canonical Portal routes `/organization/employees`,
  `/organization/departments`, and `/organization/user-employee-links`; legacy
  Vacation employee and department routes redirect to Organization.
- Added authenticated `GET /api/v1/me/employee` resolution through the explicit
  link only.
- Added canonical `/identity/users` minimal administration for creating,
  activating, and deactivating ordinary accounts. Creation assigns only the
  fixed base `User` role; self-deactivation is rejected.
- Applied migrations 009–011 locally, including the fixed-role
  `identity.assign_base_user_role(...)` hardening.
- Validated the complete controlled Sprint 04B/04C smoke flow. The duplicate
  employee-link conflict check was skipped because no second active unlinked
  user was available, which is an accepted fixture prerequisite. The configured
  basic user finished active and linked.
