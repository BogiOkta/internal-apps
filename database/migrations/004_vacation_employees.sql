CREATE TABLE vacation.departments (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id uuid NOT NULL DEFAULT gen_random_uuid(),
    code varchar(30) NOT NULL,
    name varchar(100) NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_vacation_departments_public_id UNIQUE (public_id),
    CONSTRAINT uq_vacation_departments_code UNIQUE (code)
);

CREATE TABLE vacation.employees (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id uuid NOT NULL DEFAULT gen_random_uuid(),
    employee_number varchar(30) NOT NULL,
    first_name varchar(100) NOT NULL,
    last_name varchar(100) NOT NULL,
    email varchar(254) NOT NULL,
    department_id bigint NOT NULL,
    employment_status varchar(30) NOT NULL DEFAULT 'Active',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_vacation_employees_public_id UNIQUE (public_id),
    CONSTRAINT uq_vacation_employees_employee_number UNIQUE (employee_number),
    CONSTRAINT ck_vacation_employees_employment_status
        CHECK (employment_status IN ('Active', 'Inactive')),
    CONSTRAINT fk_vacation_employees_department
        FOREIGN KEY (department_id) REFERENCES vacation.departments (id)
);

CREATE UNIQUE INDEX uq_vacation_employees_email_ci
    ON vacation.employees (lower(email));

CREATE INDEX ix_vacation_employees_department_id
    ON vacation.employees (department_id);

INSERT INTO vacation.departments (code, name)
VALUES
    ('IT', 'IT'),
    ('HR', 'HR'),
    ('FIN', 'Finance'),
    ('COM', 'Commercial'),
    ('ADM', 'Administration');

WITH employee_seed (
    employee_number,
    first_name,
    last_name,
    email,
    department_code,
    employment_status
) AS (
    VALUES
        ('EMP-0001', 'Ana', 'Jovanović', 'ana.jovanovic@example.internal', 'IT', 'Active'),
        ('EMP-0002', 'Marko', 'Petrović', 'marko.petrovic@example.internal', 'IT', 'Active'),
        ('EMP-0003', 'Milica', 'Nikolić', 'milica.nikolic@example.internal', 'HR', 'Active'),
        ('EMP-0004', 'Stefan', 'Ilić', 'stefan.ilic@example.internal', 'FIN', 'Active'),
        ('EMP-0005', 'Jelena', 'Stojanović', 'jelena.stojanovic@example.internal', 'FIN', 'Active'),
        ('EMP-0006', 'Nikola', 'Đorđević', 'nikola.djordjevic@example.internal', 'COM', 'Active'),
        ('EMP-0007', 'Marija', 'Pavlović', 'marija.pavlovic@example.internal', 'COM', 'Active'),
        ('EMP-0008', 'Luka', 'Milošević', 'luka.milosevic@example.internal', 'ADM', 'Active'),
        ('EMP-0009', 'Ivana', 'Savić', 'ivana.savic@example.internal', 'HR', 'Active'),
        ('EMP-0010', 'Miloš', 'Popović', 'milos.popovic@example.internal', 'ADM', 'Inactive')
)
INSERT INTO vacation.employees (
    employee_number,
    first_name,
    last_name,
    email,
    department_id,
    employment_status
)
SELECT
    employee_seed.employee_number,
    employee_seed.first_name,
    employee_seed.last_name,
    employee_seed.email,
    departments.id,
    employee_seed.employment_status
FROM employee_seed
INNER JOIN vacation.departments AS departments
    ON departments.code = employee_seed.department_code;

GRANT SELECT
ON vacation.departments, vacation.employees
TO internal_apps_app;
