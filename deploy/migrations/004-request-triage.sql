-- Request Portal triage: link a request to the job it became, or record why it was rejected.
-- Safe to run any number of times; runs in one transaction.
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS job_id text;
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS triaged_by text;
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS triaged_at timestamptz;
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS rejection_reason text;
UPDATE maintenance_requests r SET job_id = NULL
 WHERE job_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM jobs j WHERE j.company_id = r.company_id AND j.id = r.job_id);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'maintenance_requests_job_fk') THEN
    ALTER TABLE maintenance_requests ADD CONSTRAINT maintenance_requests_job_fk
      FOREIGN KEY (company_id, job_id) REFERENCES jobs(company_id, id);
  END IF;
END $$;
