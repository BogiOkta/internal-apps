ALTER TABLE organization.employees
    ADD COLUMN middle_name varchar(100) NULL,
    ADD COLUMN employment_start_date date NULL,
    ADD COLUMN employment_end_date date NULL,
    ALTER COLUMN email DROP NOT NULL;

ALTER TABLE organization.employees
    ADD CONSTRAINT ck_organization_employees_employment_dates
        CHECK (
            employment_start_date IS NULL
            OR employment_end_date IS NULL
            OR employment_end_date >= employment_start_date
        );

GRANT INSERT (middle_name, employment_start_date, employment_end_date)
ON organization.employees TO internal_apps_app;

GRANT UPDATE (middle_name, employment_start_date, employment_end_date)
ON organization.employees TO internal_apps_app;
