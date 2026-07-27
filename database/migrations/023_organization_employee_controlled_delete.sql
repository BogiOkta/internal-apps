-- API preflight rejects every dependent row; restrictive foreign keys remain intact.
GRANT DELETE ON organization.employees TO internal_apps_app;
