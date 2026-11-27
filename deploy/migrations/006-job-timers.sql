-- Mobile app: one running/paused job timer per engineer. Safe to run any number of times.
CREATE TABLE IF NOT EXISTS job_timers (
  user_id integer NOT NULL,
  job_id text NOT NULL,
  started_at timestamptz,
  accumulated_seconds integer NOT NULL DEFAULT 0 CHECK (accumulated_seconds >= 0),
  work_date date NOT NULL,
  company_id integer NOT NULL,
  CONSTRAINT job_timers_pkey PRIMARY KEY (company_id, user_id),
  CONSTRAINT job_timers_company_id_companies_id_fk FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT job_timers_user_fk FOREIGN KEY (company_id, user_id) REFERENCES users(company_id, id) ON DELETE CASCADE,
  CONSTRAINT job_timers_job_fk FOREIGN KEY (company_id, job_id) REFERENCES jobs(company_id, id) ON DELETE CASCADE
);
