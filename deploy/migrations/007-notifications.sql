-- Notifications: in-app list, phone push subscriptions, per-user settings, once-a-day runs.
-- Safe to run any number of times.
CREATE TABLE IF NOT EXISTS notifications (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id integer NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  company_id integer NOT NULL,
  CONSTRAINT notifications_company_id_companies_id_fk FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT notifications_user_fk FOREIGN KEY (company_id, user_id) REFERENCES users(company_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (company_id, user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id integer NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_ok_at timestamptz,
  company_id integer NOT NULL,
  CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint),
  CONSTRAINT push_subscriptions_company_id_companies_id_fk FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT push_subscriptions_user_fk FOREIGN KEY (company_id, user_id) REFERENCES users(company_id, id) ON DELETE CASCADE
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS notification_runs (
  company_id integer NOT NULL REFERENCES companies(id),
  kind text NOT NULL,
  run_date date NOT NULL,
  ran_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_runs_pkey PRIMARY KEY (company_id, kind, run_date)
);

-- Server-wide settings, e.g. the generated Web Push (VAPID) key pair.
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
