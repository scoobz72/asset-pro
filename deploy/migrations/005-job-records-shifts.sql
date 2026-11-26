-- Job records (labour, notes, follow-ups), engineer shift patterns and absences
-- (docs/asset-stock-jobs-plan.md 1.2). Safe to run any number of times; one transaction.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS hourly_rate numeric(8, 2);

CREATE TABLE IF NOT EXISTS job_labour (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id text NOT NULL,
  user_id integer NOT NULL,
  work_date date NOT NULL,
  hours numeric(5, 2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  rate numeric(8, 2),
  note text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  company_id integer NOT NULL,
  CONSTRAINT job_labour_company_id_companies_id_fk FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT job_labour_job_fk FOREIGN KEY (company_id, job_id) REFERENCES jobs(company_id, id) ON DELETE CASCADE,
  CONSTRAINT job_labour_user_fk FOREIGN KEY (company_id, user_id) REFERENCES users(company_id, id)
);
CREATE INDEX IF NOT EXISTS job_labour_user_date_idx ON job_labour (company_id, user_id, work_date);
CREATE INDEX IF NOT EXISTS job_labour_job_idx ON job_labour (company_id, job_id);

CREATE TABLE IF NOT EXISTS job_notes (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id text NOT NULL,
  kind text NOT NULL DEFAULT 'Note',
  text text NOT NULL,
  user_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  follow_up_job_id text,
  company_id integer NOT NULL,
  CONSTRAINT job_notes_company_id_companies_id_fk FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT job_notes_job_fk FOREIGN KEY (company_id, job_id) REFERENCES jobs(company_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS job_notes_job_idx ON job_notes (company_id, job_id, created_at);

CREATE TABLE IF NOT EXISTS shift_patterns (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id integer NOT NULL,
  effective_from date NOT NULL,
  mon numeric(4, 2) NOT NULL DEFAULT 0,
  tue numeric(4, 2) NOT NULL DEFAULT 0,
  wed numeric(4, 2) NOT NULL DEFAULT 0,
  thu numeric(4, 2) NOT NULL DEFAULT 0,
  fri numeric(4, 2) NOT NULL DEFAULT 0,
  sat numeric(4, 2) NOT NULL DEFAULT 0,
  sun numeric(4, 2) NOT NULL DEFAULT 0,
  company_id integer NOT NULL,
  CONSTRAINT shift_patterns_company_id_companies_id_fk FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT shift_patterns_user_fk FOREIGN KEY (company_id, user_id) REFERENCES users(company_id, id),
  CONSTRAINT shift_patterns_user_from_key UNIQUE (company_id, user_id, effective_from)
);

CREATE TABLE IF NOT EXISTS absences (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id integer NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  hours_per_day numeric(4, 2),
  reason text NOT NULL DEFAULT 'Holiday',
  note text,
  company_id integer NOT NULL,
  CONSTRAINT absences_company_id_companies_id_fk FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT absences_user_fk FOREIGN KEY (company_id, user_id) REFERENCES users(company_id, id),
  CONSTRAINT absences_dates_check CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS absences_user_idx ON absences (company_id, user_id, start_date);
